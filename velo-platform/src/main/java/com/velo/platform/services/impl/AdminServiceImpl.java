package com.velo.platform.services.impl;

import com.velo.platform.dto.admin.AdminStatsDto;
import com.velo.platform.dto.admin.DashboardDto;
import com.velo.platform.dto.admin.PendingDriverDto;
import com.velo.platform.dto.admin.RevenueReportDto;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.PaymentStatus;
import com.velo.platform.entities.enums.RideRequestStatus;
import com.velo.platform.entities.enums.RideStatus;
import com.velo.platform.exceptions.RuntimeConflictException;
import com.velo.platform.repositories.*;
import com.velo.platform.services.AdminService;
import com.velo.platform.services.CacheService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
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
    private final CacheService cacheService;

    private static final BigDecimal PLATFORM_COMMISSION = BigDecimal.valueOf(0.30);
    private static final double PENDING_DRIVER_APPROVAL_THRESHOLD = 1.0;

    @Override
    @Transactional(readOnly = true)
    public DashboardDto getDashboard() {
        Object cached = cacheService.getCachedDashboard();
        if (cached != null) {
            return (DashboardDto) cached;
        }
        
        long totalUsers = userRepository.count();
        long totalDrivers = driverRepository.count();
        long totalRides = rideRepository.count();

        BigDecimal totalRevenue = nullToZero(paymentRepository.sumAmountByPaymentStatus(PaymentStatus.CONFIRMED));
        long activeRides = rideRepository.countByRideStatus(RideStatus.ONGOING);

        long pendingApprovals = countPendingDriverApprovals();

        Map<String, Long> ridesByStatus = new HashMap<>();
        ridesByStatus.put("COMPLETED", rideRepository.countByRideStatus(RideStatus.ENDED));
        ridesByStatus.put("CANCELLED", rideRepository.countByRideStatus(RideStatus.CANCELLED));
        ridesByStatus.put("ONGOING", activeRides);
        ridesByStatus.put("CONFIRMED", rideRepository.countByRideStatus(RideStatus.CONFIRMED));

        DashboardDto dashboard = DashboardDto.builder()
                .totalUsers(totalUsers)
                .totalDrivers(totalDrivers)
                .totalRides(totalRides)
                .totalRevenue(totalRevenue)
                .activeRides(activeRides)
                .pendingApprovals(pendingApprovals)
                .ridesByStatus(ridesByStatus)
                .build();
        
        cacheService.cacheDashboard(dashboard);
        return dashboard;
    }

    @Override
    @Transactional(readOnly = true)
    public AdminStatsDto getDailyStats(LocalDate date) {
        LocalDateTime startOfDay = date.atStartOfDay();
        LocalDateTime endOfDay = date.plusDays(1).atStartOfDay();

        long activeDrivers = getAvailableDriversCount();
        DailyRideStats dailyRideStats = getDailyRideStats(startOfDay, endOfDay);
        BigDecimal platformCommission = dailyRideStats.totalRevenue().multiply(PLATFORM_COMMISSION);
        long totalUsers = userRepository.count();
        long newUsers = userRepository.countByCreatedTimeAfterAndCreatedTimeBefore(startOfDay, endOfDay);
        long pendingDriverApprovals = rideRequestRepository.countByRideRequestStatus(RideRequestStatus.PENDING);

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
        return startDate.datesUntil(endDate.plusDays(1))
                .map(date -> {
                    DailyRideStats stats = getDailyRideStats(date.atStartOfDay(), date.plusDays(1).atStartOfDay());
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
    public Page<PendingDriverDto> getPendingDrivers(Pageable pageable) {
        return driverRepository.findPendingDriverApprovals(PENDING_DRIVER_APPROVAL_THRESHOLD, pageable)
                .map(driver -> {
                    User user = driver.getUser();
                    return PendingDriverDto.builder()
                            .driverId(driver.getId())
                            .userId(user != null ? user.getId() : null)
                            .name(user != null ? user.getFirstName() + " " + user.getLastName() : "Unknown")
                            .email(user != null ? user.getEmail() : "Unknown")
                            .phone(user != null ? user.getPhoneNumber() : "Unknown")
                            .rating(driver.getRating())
                            .vehicleId(driver.getVehicleId())
                            .appliedAt(driver.getCreatedAt())
                            .build();
                });
    }

    @Override
    @Transactional
    public void approveDriver(Long driverId) {
        Driver driver = driverRepository.findById(driverId)
                .orElseThrow(() -> new RuntimeConflictException("Driver not found"));
        driver.setAvailable(true);
        driverRepository.save(driver);
        cacheService.evictAvailableDriversCache();
        cacheService.evictDashboardCache();
    }

    @Override
    @Transactional
    public void rejectDriver(Long driverId, String reason) {
        Driver driver = driverRepository.findById(driverId)
                .orElseThrow(() -> new RuntimeConflictException("Driver not found"));
        driver.setAvailable(false);
        driverRepository.save(driver);
        cacheService.evictDashboardCache();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<User> getAllUsers(Pageable pageable) {
        return userRepository.findAll(pageable);
    }

    @Override
    @Transactional
    public void deactivateUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeConflictException("User not found"));
        user.setActive(false);
        userRepository.save(user);
    }

    @Override
    @Transactional
    public void activateUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeConflictException("User not found"));
        user.setActive(true);
        userRepository.save(user);
    }

    private long getAvailableDriversCount() {
        Long cachedCount = cacheService.getAvailableDriversCount();
        if (cachedCount != null) {
            return cachedCount;
        }

        // Cache miss falls back to a database count.
        long activeDrivers = driverRepository.countByAvailableTrue();
        cacheService.cacheAvailableDriversCount(activeDrivers);
        return activeDrivers;
    }

    private long countPendingDriverApprovals() {
        return driverRepository.countPendingDriverApprovals(PENDING_DRIVER_APPROVAL_THRESHOLD);
    }

    private DailyRideStats getDailyRideStats(LocalDateTime startOfDay, LocalDateTime endOfDay) {
        long totalRides = rideRepository.countByCreatedTimeAfterAndCreatedTimeBefore(startOfDay, endOfDay);
        long completedRides = rideRepository.countByCreatedTimeAfterAndCreatedTimeBeforeAndRideStatus(
                startOfDay, endOfDay, RideStatus.ENDED);
        long cancelledRides = rideRepository.countByCreatedTimeAfterAndCreatedTimeBeforeAndRideStatus(
                startOfDay, endOfDay, RideStatus.CANCELLED);
        BigDecimal totalRevenue = nullToZero(rideRepository.sumFareByCreatedTimeAfterAndCreatedTimeBefore(startOfDay, endOfDay));

        return new DailyRideStats(totalRides, completedRides, cancelledRides, totalRevenue);
    }

    private BigDecimal nullToZero(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private record DailyRideStats(long totalRides, long completedRides, long cancelledRides, BigDecimal totalRevenue) {
    }
}
