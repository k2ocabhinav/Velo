package com.velo.platform.repositories;

import com.velo.platform.dto.EarningsSummaryDto;
import com.velo.platform.dto.admin.TopDriverRevenueDto;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.DriverEarning;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public interface DriverEarningRepository extends JpaRepository<DriverEarning, Long> {
    Page<DriverEarning> findByDriverOrderByCreatedTimeDesc(Driver driver, Pageable pageable);
    boolean existsByRide_Id(Long rideId);

    @Query("SELECT new com.velo.platform.dto.EarningsSummaryDto(" +
           "SUM(e.grossFare), SUM(e.platformCommission), SUM(e.netEarning), COUNT(e), " +
           ":startDate, :endDate) " +
           "FROM DriverEarning e WHERE e.driver = :driver " +
           "AND e.createdTime >= :startDate AND e.createdTime < :endDate")
    EarningsSummaryDto getEarningsSummary(@Param("driver") Driver driver,
                                          @Param("startDate") LocalDateTime startDate,
                                          @Param("endDate") LocalDateTime endDate);

    @Query("SELECT COALESCE(SUM(e.netEarning), 0) FROM DriverEarning e WHERE e.driver = :driver")
    BigDecimal getTotalNetEarningsByDriver(@Param("driver") Driver driver);

    @Query("SELECT new com.velo.platform.dto.admin.TopDriverRevenueDto(" +
           "d.id, COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.firstName, ''), ' ', COALESCE(u.lastName, ''))), ''), 'Unknown driver'), " +
           "COUNT(e), SUM(e.grossFare), SUM(e.platformCommission), SUM(e.netEarning)) " +
           "FROM DriverEarning e JOIN e.driver d LEFT JOIN d.user u " +
           "WHERE e.tenantId = :tenantId AND d.tenantId = :tenantId " +
           "AND (u IS NULL OR u.tenantId = :tenantId) " +
           "AND e.createdTime >= :startDate AND e.createdTime < :endDate " +
           "GROUP BY d.id, u.firstName, u.lastName " +
           "ORDER BY SUM(e.netEarning) DESC, d.id ASC")
    java.util.List<TopDriverRevenueDto> findTopDriversByNetEarnings(
            @Param("tenantId") Long tenantId,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate,
            Pageable pageable);
}
