package com.velo.platform.services.impl;

import com.velo.platform.dto.admin.AdminStatsDto;
import com.velo.platform.dto.admin.DashboardDto;
import com.velo.platform.dto.admin.PendingDriverDto;
import com.velo.platform.dto.admin.RevenueReportDto;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.DriverOnboardingStatus;
import com.velo.platform.entities.enums.PaymentStatus;
import com.velo.platform.entities.enums.Role;
import com.velo.platform.entities.enums.RideStatus;
import com.velo.platform.repositories.DriverRepository;
import com.velo.platform.repositories.PaymentRepository;
import com.velo.platform.repositories.RideRequestRepository;
import com.velo.platform.repositories.RideRepository;
import com.velo.platform.repositories.UserRepository;
import com.velo.platform.services.CacheService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private DriverRepository driverRepository;

    @Mock
    private RideRepository rideRepository;

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private RideRequestRepository rideRequestRepository;

    @Mock
    private CacheService cacheService;

    @InjectMocks
    private AdminServiceImpl adminService;

    @Test
    @DisplayName("Dashboard should read all totals from repository aggregates")
    void getDashboard_ShouldUseAggregateQueries() {
        when(cacheService.getCachedDashboard()).thenReturn(null);
        when(userRepository.count()).thenReturn(12L);
        when(driverRepository.count()).thenReturn(5L);
        when(rideRepository.count()).thenReturn(27L);
        when(paymentRepository.sumAmountByPaymentStatus(PaymentStatus.CONFIRMED))
                .thenReturn(BigDecimal.valueOf(410.75));
        when(rideRepository.countByRideStatus(RideStatus.ONGOING)).thenReturn(3L);
        when(driverRepository.countByOnboardingStatus(DriverOnboardingStatus.PENDING)).thenReturn(2L);

        DashboardDto dashboard = adminService.getDashboard();

        assertThat(dashboard.getTotalUsers()).isEqualTo(12L);
        assertThat(dashboard.getTotalDrivers()).isEqualTo(5L);
        assertThat(dashboard.getTotalRides()).isEqualTo(27L);
        assertThat(dashboard.getTotalRevenue()).isEqualByComparingTo("410.75");
        assertThat(dashboard.getActiveRides()).isEqualTo(3L);
        assertThat(dashboard.getPendingApprovals()).isEqualTo(2L);
        assertThat(dashboard.getRidesByStatus()).containsEntry("ONGOING", 3L);

        verify(cacheService).cacheDashboard(dashboard);
        verify(driverRepository, never()).findAll();
    }

    @Test
    @DisplayName("Daily stats should use query-backed metrics and cache available drivers")
    void getDailyStats_ShouldUseDatabaseAggregatesAndCacheAvailableDrivers() {
        LocalDate date = LocalDate.of(2026, 4, 7);
        LocalDateTime start = date.atStartOfDay();
        LocalDateTime end = date.plusDays(1).atStartOfDay();

        when(cacheService.getAvailableDriversCount()).thenReturn(null);
        when(driverRepository.countByAvailableTrue()).thenReturn(8L);
        when(rideRepository.countByCreatedTimeAfterAndCreatedTimeBefore(start, end)).thenReturn(11L);
        when(rideRepository.countByCreatedTimeAfterAndCreatedTimeBeforeAndRideStatus(start, end, RideStatus.ENDED))
                .thenReturn(7L);
        when(rideRepository.countByCreatedTimeAfterAndCreatedTimeBeforeAndRideStatus(start, end, RideStatus.CANCELLED))
                .thenReturn(2L);
        when(rideRepository.sumFareByCreatedTimeAfterAndCreatedTimeBefore(start, end)).thenReturn(BigDecimal.valueOf(560.00));
        when(userRepository.count()).thenReturn(42L);
        when(userRepository.countByCreatedTimeAfterAndCreatedTimeBefore(start, end)).thenReturn(4L);
        when(driverRepository.countByOnboardingStatus(DriverOnboardingStatus.PENDING)).thenReturn(6L);

        AdminStatsDto stats = adminService.getDailyStats(date);

        assertThat(stats.getDate()).isEqualTo(date);
        assertThat(stats.getTotalRides()).isEqualTo(11L);
        assertThat(stats.getCompletedRides()).isEqualTo(7L);
        assertThat(stats.getCancelledRides()).isEqualTo(2L);
        assertThat(stats.getTotalRevenue()).isEqualByComparingTo("560.00");
        assertThat(stats.getPlatformCommission()).isEqualByComparingTo("168.000");
        assertThat(stats.getTotalUsers()).isEqualTo(42L);
        assertThat(stats.getNewUsers()).isEqualTo(4L);
        assertThat(stats.getActiveDrivers()).isEqualTo(8L);
        assertThat(stats.getPendingDriverApprovals()).isEqualTo(6L);

        verify(cacheService).cacheAvailableDriversCount(8L);
        verify(driverRepository).countByAvailableTrue();
    }

    @Test
    @DisplayName("Daily stats should trust the cached available driver count")
    void getDailyStats_ShouldUseCachedAvailableDriversCount() {
        LocalDate date = LocalDate.of(2026, 4, 7);
        LocalDateTime start = date.atStartOfDay();
        LocalDateTime end = date.plusDays(1).atStartOfDay();

        when(cacheService.getAvailableDriversCount()).thenReturn(9L);
        when(rideRepository.countByCreatedTimeAfterAndCreatedTimeBefore(start, end)).thenReturn(5L);
        when(rideRepository.countByCreatedTimeAfterAndCreatedTimeBeforeAndRideStatus(start, end, RideStatus.ENDED))
                .thenReturn(3L);
        when(rideRepository.countByCreatedTimeAfterAndCreatedTimeBeforeAndRideStatus(start, end, RideStatus.CANCELLED))
                .thenReturn(1L);
        when(rideRepository.sumFareByCreatedTimeAfterAndCreatedTimeBefore(start, end)).thenReturn(BigDecimal.valueOf(120.00));
        when(userRepository.count()).thenReturn(20L);
        when(userRepository.countByCreatedTimeAfterAndCreatedTimeBefore(start, end)).thenReturn(2L);
        when(driverRepository.countByOnboardingStatus(DriverOnboardingStatus.PENDING)).thenReturn(4L);

        AdminStatsDto stats = adminService.getDailyStats(date);

        assertThat(stats.getActiveDrivers()).isEqualTo(9L);
        verify(cacheService, never()).cacheAvailableDriversCount(anyLong());
        verify(driverRepository, never()).countByAvailableTrue();
    }

    @Test
    @DisplayName("Revenue report should reuse the daily ride aggregate query path")
    void getRevenueReport_ShouldUseDailyRideAggregates() {
        LocalDate startDate = LocalDate.of(2026, 4, 1);
        LocalDate endDate = LocalDate.of(2026, 4, 2);

        LocalDateTime dayOneStart = startDate.atStartOfDay();
        LocalDateTime dayOneEnd = startDate.plusDays(1).atStartOfDay();
        LocalDateTime dayTwoStart = endDate.atStartOfDay();
        LocalDateTime dayTwoEnd = endDate.plusDays(1).atStartOfDay();

        when(rideRepository.countByCreatedTimeAfterAndCreatedTimeBefore(dayOneStart, dayOneEnd))
                .thenReturn(6L);
        when(rideRepository.countByCreatedTimeAfterAndCreatedTimeBeforeAndRideStatus(dayOneStart, dayOneEnd, RideStatus.ENDED))
                .thenReturn(4L);
        when(rideRepository.countByCreatedTimeAfterAndCreatedTimeBeforeAndRideStatus(dayOneStart, dayOneEnd, RideStatus.CANCELLED))
                .thenReturn(1L);
        when(rideRepository.sumFareByCreatedTimeAfterAndCreatedTimeBefore(dayOneStart, dayOneEnd)).thenReturn(BigDecimal.valueOf(180.00));

        when(rideRepository.countByCreatedTimeAfterAndCreatedTimeBefore(dayTwoStart, dayTwoEnd))
                .thenReturn(3L);
        when(rideRepository.countByCreatedTimeAfterAndCreatedTimeBeforeAndRideStatus(dayTwoStart, dayTwoEnd, RideStatus.ENDED))
                .thenReturn(2L);
        when(rideRepository.countByCreatedTimeAfterAndCreatedTimeBeforeAndRideStatus(dayTwoStart, dayTwoEnd, RideStatus.CANCELLED))
                .thenReturn(0L);
        when(rideRepository.sumFareByCreatedTimeAfterAndCreatedTimeBefore(dayTwoStart, dayTwoEnd)).thenReturn(BigDecimal.valueOf(90.00));

        List<RevenueReportDto> report = adminService.getRevenueReport(startDate, endDate);

        assertThat(report).hasSize(2);
        assertThat(report.get(0).getDate()).isEqualTo(startDate);
        assertThat(report.get(0).getGrossRevenue()).isEqualByComparingTo("180.00");
        assertThat(report.get(0).getPlatformCommission()).isEqualByComparingTo("54.000");
        assertThat(report.get(0).getDriverEarnings()).isEqualByComparingTo("126.000");
        assertThat(report.get(0).getRideCount()).isEqualTo(4L);

        assertThat(report.get(1).getDate()).isEqualTo(endDate);
        assertThat(report.get(1).getGrossRevenue()).isEqualByComparingTo("90.00");
        assertThat(report.get(1).getPlatformCommission()).isEqualByComparingTo("27.000");
        assertThat(report.get(1).getDriverEarnings()).isEqualByComparingTo("63.000");
        assertThat(report.get(1).getRideCount()).isEqualTo(2L);

        verifyNoInteractions(userRepository, cacheService, driverRepository, paymentRepository, rideRequestRepository);
    }

    @Test
    @DisplayName("Pending drivers should use the pending-approval query instead of paging the full driver table")
    void getPendingDrivers_ShouldUsePendingApprovalQuery() {
        User user = new User();
        user.setId(44L);
        user.setFirstName("Asha");
        user.setLastName("Driver");
        user.setEmail("asha@example.com");
        user.setPhoneNumber("9999999999");
        user.setRoles(Set.of(Role.DRIVER));

        Driver driver = new Driver();
        driver.setId(11L);
        driver.setUser(user);
        driver.setVehicleId("KA01AB1234");

        PageRequest pageRequest = PageRequest.of(0, 10);
        driver.setOnboardingStatus(DriverOnboardingStatus.PENDING);

        when(driverRepository.findByOnboardingStatusOrderByCreatedAtDesc(DriverOnboardingStatus.PENDING, pageRequest))
                .thenReturn(new PageImpl<>(List.of(driver), pageRequest, 1));

        Page<PendingDriverDto> result = adminService.getPendingDrivers(pageRequest);

        assertThat(result.getContent()).singleElement().satisfies(dto -> {
            assertThat(dto.getDriverId()).isEqualTo(11L);
            assertThat(dto.getUserId()).isEqualTo(44L);
            assertThat(dto.getName()).isEqualTo("Asha Driver");
            assertThat(dto.getEmail()).isEqualTo("asha@example.com");
            assertThat(dto.getPhone()).isEqualTo("9999999999");
            assertThat(dto.getVehicleId()).isEqualTo("KA01AB1234");
            assertThat(dto.getOnboardingStatus()).isEqualTo("PENDING");
        });
        verify(driverRepository).findByOnboardingStatusOrderByCreatedAtDesc(DriverOnboardingStatus.PENDING, pageRequest);
        verify(driverRepository, never()).findAll(pageRequest);
    }

    @Test
    @DisplayName("Deactivate user should persist active=false")
    void deactivateUser_ShouldSetActiveFalse() {
        User user = new User();
        user.setId(55L);
        user.setActive(true);
        when(userRepository.findById(55L)).thenReturn(Optional.of(user));

        adminService.deactivateUser(55L);

        assertThat(user.getActive()).isFalse();
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("Activate user should persist active=true")
    void activateUser_ShouldSetActiveTrue() {
        User user = new User();
        user.setId(56L);
        user.setActive(false);
        when(userRepository.findById(56L)).thenReturn(Optional.of(user));

        adminService.activateUser(56L);

        assertThat(user.getActive()).isTrue();
        verify(userRepository).save(user);
    }
}
