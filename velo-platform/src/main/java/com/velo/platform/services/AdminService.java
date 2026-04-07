package com.velo.platform.services;

import com.velo.platform.dto.admin.AdminStatsDto;
import com.velo.platform.dto.admin.DashboardDto;
import com.velo.platform.dto.admin.PendingDriverDto;
import com.velo.platform.dto.admin.RevenueReportDto;
import com.velo.platform.entities.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.time.LocalDate;
import java.util.List;

public interface AdminService {
    DashboardDto getDashboard();
    AdminStatsDto getDailyStats(LocalDate date);
    List<RevenueReportDto> getRevenueReport(LocalDate startDate, LocalDate endDate);
    Page<PendingDriverDto> getPendingDrivers(Pageable pageable);
    void approveDriver(Long driverId);
    void rejectDriver(Long driverId, String reason);
    Page<User> getAllUsers(Pageable pageable);
    void deactivateUser(Long userId);
    void activateUser(Long userId);
}
