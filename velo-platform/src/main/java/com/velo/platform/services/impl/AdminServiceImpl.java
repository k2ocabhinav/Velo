package com.velo.platform.services.impl;

import com.velo.platform.utils.UtcTimes;
import com.velo.platform.dto.admin.AdminStatsDto;
import com.velo.platform.dto.admin.AdminUserDto;
import com.velo.platform.dto.admin.DashboardDto;
import com.velo.platform.dto.admin.PendingDriverDto;
import com.velo.platform.dto.admin.RevenueReportDto;
import com.velo.platform.dto.admin.TopDriverRevenueDto;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.DriverOnboardingStatus;
import com.velo.platform.entities.enums.PaymentStatus;
import com.velo.platform.entities.enums.RideRequestStatus;
import com.velo.platform.entities.enums.RideStatus;
import com.velo.platform.exceptions.ResourceNotFoundException;
import com.velo.platform.repositories.*;
import com.velo.platform.services.AdminService;
import com.velo.platform.services.CacheService;
import com.velo.platform.services.TenantScopeService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminServiceImpl implements AdminService {

    private final UserRepository userRepository;
    private final DriverRepository driverRepository;
    private final RideRepository rideRepository;
    private final PaymentRepository paymentRepository;
    private final RideRequestRepository rideRequestRepository;
    private final DriverEarningRepository driverEarningRepository;
    private final CacheService cacheService;
    private final TenantScopeService tenantScopeService;

    private static final BigDecimal PLATFORM_COMMISSION = BigDecimal.valueOf(0.30);

    @Override
    @Transactional(readOnly = true)
    public DashboardDto getDashboard() {
        Long tenantId = currentTenantId();

        long totalUsers = userRepository.countByTenantId(tenantId);
        long totalDrivers = driverRepository.countByTenantId(tenantId);
        long totalRides = rideRepository.countByTenantId(tenantId);

        BigDecimal totalRevenue = nullToZero(paymentRepository.sumAmountByTenantIdAndPaymentStatus(tenantId, PaymentStatus.CONFIRMED));
        long activeRides = rideRepository.countByTenantIdAndRideStatus(tenantId, RideStatus.ONGOING);

        long pendingApprovals = countPendingDriverApprovals();

        Map<String, Long> ridesByStatus = new HashMap<>();
        ridesByStatus.put("COMPLETED", rideRepository.countByTenantIdAndRideStatus(tenantId, RideStatus.ENDED));
        ridesByStatus.put("CANCELLED", rideRepository.countByTenantIdAndRideStatus(tenantId, RideStatus.CANCELLED));
        ridesByStatus.put("ONGOING", activeRides);
        ridesByStatus.put("CONFIRMED", rideRepository.countByTenantIdAndRideStatus(tenantId, RideStatus.CONFIRMED));

        DashboardDto dashboard = DashboardDto.builder()
                .totalUsers(totalUsers)
                .totalDrivers(totalDrivers)
                .totalRides(totalRides)
                .totalRevenue(totalRevenue)
                .activeRides(activeRides)
                .pendingApprovals(pendingApprovals)
                .ridesByStatus(ridesByStatus)
                .build();

        return dashboard;
    }

    @Override
    @Transactional(readOnly = true)
    public AdminStatsDto getDailyStats(LocalDate date) {
        Long tenantId = currentTenantId();
        LocalDateTime startOfDay = date.atStartOfDay();
        LocalDateTime endOfDay = date.plusDays(1).atStartOfDay();

        long activeDrivers = getAvailableDriversCount();
        DailyRideStats dailyRideStats = getDailyRideStats(tenantId, startOfDay, endOfDay);
        BigDecimal platformCommission = dailyRideStats.totalRevenue().multiply(PLATFORM_COMMISSION);
        long totalUsers = userRepository.countByTenantId(tenantId);
        long newUsers = userRepository.countByTenantIdAndCreatedTimeAfterAndCreatedTimeBefore(tenantId, startOfDay, endOfDay);
        long pendingDriverApprovals = countPendingDriverApprovals();

        return AdminStatsDto.builder()
                .date(date)
                .totalRides(dailyRideStats.totalRides())
                .completedRides(dailyRideStats.completedRides())
                .cancelledRides(dailyRideStats.cancelledRides())
                .totalRevenue(dailyRideStats.totalRevenue())
                .platformCommission(platformCommission)
                .totalUsers(totalUsers)
                .newUsers(newUsers)
                .activeDrivers(activeDrivers)
                .pendingDriverApprovals(pendingDriverApprovals)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<RevenueReportDto> getRevenueReport(LocalDate startDate, LocalDate endDate) {
        Long tenantId = currentTenantId();
        return startDate.datesUntil(endDate.plusDays(1))
                .map(date -> {
                    DailyRideStats stats = getDailyRideStats(tenantId, date.atStartOfDay(), date.plusDays(1).atStartOfDay());
                    // Revenue report only needs ride-side aggregates.
                    return RevenueReportDto.builder()
                            .date(date)
                            .grossRevenue(stats.totalRevenue())
                            .platformCommission(stats.totalRevenue().multiply(PLATFORM_COMMISSION))
                            .driverEarnings(stats.totalRevenue().multiply(BigDecimal.ONE.subtract(PLATFORM_COMMISSION)))
                            .rideCount(stats.completedRides())
                            .build();
                })
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<TopDriverRevenueDto> getTopDriversByRevenue(int days) {
        LocalDate today = UtcTimes.today();
        LocalDateTime startDate = today.minusDays(days - 1L).atStartOfDay();
        LocalDateTime endDate = today.plusDays(1).atStartOfDay();
        return driverEarningRepository.findTopDriversByNetEarnings(
                currentTenantId(), startDate, endDate, PageRequest.of(0, 10));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PendingDriverDto> getPendingDrivers(Pageable pageable) {
        return getDriversByStatus(DriverOnboardingStatus.PENDING, pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PendingDriverDto> getDriversByStatus(DriverOnboardingStatus status, Pageable pageable) {
        Long tenantId = currentTenantId();
        return driverRepository.findByTenantIdAndOnboardingStatusOrderByCreatedAtDesc(tenantId, status, pageable)
                .map(this::toPendingDriverDto);
    }

    @Override
    @Transactional
    public void approveDriver(Long driverId) {
        Driver driver = requireTenantDriver(driverId);
        driver.setOnboardingStatus(DriverOnboardingStatus.APPROVED);
        driver.setAvailable(true);
        driver.setRejectionReason(null);
        driverRepository.save(driver);
        cacheService.evictAvailableDriversCache();
        cacheService.evictDashboardCache();
    }

    @Override
    @Transactional
    public void suspendDriver(Long driverId) {
        Driver driver = requireTenantDriver(driverId);
        driver.setOnboardingStatus(DriverOnboardingStatus.SUSPENDED);
        driver.setAvailable(false);
        driverRepository.save(driver);
        cacheService.evictAvailableDriversCache();
        cacheService.evictDashboardCache();
    }

    @Override
    @Transactional
    public void rejectDriver(Long driverId, String reason) {
        Driver driver = requireTenantDriver(driverId);
        driver.setOnboardingStatus(DriverOnboardingStatus.REJECTED);
        driver.setAvailable(false);
        driver.setRejectionReason(clean(reason));
        driverRepository.save(driver);
        cacheService.evictAvailableDriversCache();
        cacheService.evictDashboardCache();
    }

    /**
     * Loads a driver that belongs to the caller's tenant. A driver in another tenant is reported as
     * not found so the endpoint never discloses that the id exists elsewhere.
     */
    private Driver requireTenantDriver(Long driverId) {
        Long tenantId = currentTenantId();
        return driverRepository.findById(driverId)
                .filter(driver -> tenantId.equals(driver.getTenantId()))
                .orElseThrow(() -> new ResourceNotFoundException("Driver not found"));
    }

    private String clean(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AdminUserDto> getAllUsers(Pageable pageable) {
        Long tenantId = currentTenantId();
        return userRepository.findByTenantId(tenantId, pageable).map(this::toAdminUserDto);
    }

    @Override
    @Transactional
    public void deactivateUser(Long userId) {
        User user = userRepository.findByIdAndTenantId(userId, currentTenantId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        user.setActive(false);
        userRepository.save(user);
    }

    @Override
    @Transactional
    public void activateUser(Long userId) {
        User user = userRepository.findByIdAndTenantId(userId, currentTenantId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        user.setActive(true);
        userRepository.save(user);
    }

    private long getAvailableDriversCount() {
        Long tenantId = currentTenantId();
        return driverRepository.countByTenantIdAndAvailableTrue(tenantId);
    }

    private long countPendingDriverApprovals() {
        Long tenantId = currentTenantId();
        return driverRepository.countByTenantIdAndOnboardingStatus(tenantId, DriverOnboardingStatus.PENDING);
    }

    private DailyRideStats getDailyRideStats(Long tenantId, LocalDateTime startOfDay, LocalDateTime endOfDay) {
        long totalRides = rideRepository.countByTenantIdAndCreatedTimeAfterAndCreatedTimeBefore(tenantId, startOfDay, endOfDay);
        long completedRides = rideRepository.countByTenantIdAndCreatedTimeAfterAndCreatedTimeBeforeAndRideStatus(
                tenantId, startOfDay, endOfDay, RideStatus.ENDED);
        long cancelledRides = rideRepository.countByTenantIdAndCreatedTimeAfterAndCreatedTimeBeforeAndRideStatus(
                tenantId, startOfDay, endOfDay, RideStatus.CANCELLED);
        BigDecimal totalRevenue = nullToZero(rideRepository.sumFareByTenantIdAndCreatedTimeAfterAndCreatedTimeBefore(
                tenantId,
                startOfDay,
                endOfDay
        ));

        return new DailyRideStats(totalRides, completedRides, cancelledRides, totalRevenue);
    }

    private BigDecimal nullToZero(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private Long currentTenantId() {
        if (tenantScopeService == null) {
            return 1L;
        }
        return tenantScopeService.requireCurrentTenantId();
    }

    private record DailyRideStats(long totalRides, long completedRides, long cancelledRides, BigDecimal totalRevenue) {
    }

    private PendingDriverDto toPendingDriverDto(Driver driver) {
        User user = driver.getUser();
        String name = "Unknown";
        if (user != null) {
            String fullName = ((user.getFirstName() == null ? "" : user.getFirstName()) + " " +
                    (user.getLastName() == null ? "" : user.getLastName())).trim();
            name = fullName.isEmpty() ? "Unknown" : fullName;
        }
        return PendingDriverDto.builder()
                .driverId(driver.getId())
                .userId(user != null ? user.getId() : null)
                .name(name)
                .email(user != null ? user.getEmail() : "Unknown")
                .phone(user != null ? user.getPhoneNumber() : "Unknown")
                .rating(driver.getRating())
                .vehicleId(driver.getVehicleId())
                .onboardingStatus(driver.getOnboardingStatus() == null ? null : driver.getOnboardingStatus().name())
                .appliedAt(driver.getCreatedAt())
                .build();
    }

    private AdminUserDto toAdminUserDto(User user) {
        return AdminUserDto.builder()
                .id(user.getId())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .email(user.getEmail())
                .phoneNumber(user.getPhoneNumber())
                .active(user.getActive())
                .tenantId(user.getTenantId())
                .referralCode(user.getReferralCode())
                .createdTime(user.getCreatedTime())
                .roles(user.getRoles())
                .build();
    }
}
