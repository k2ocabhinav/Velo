package com.velo.platform.repositories;

import com.velo.platform.entities.User;
import com.velo.platform.entities.Wallet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface WalletRepository extends JpaRepository<Wallet, Long> {
    Optional<Wallet> findByUser(User user);

    @Query("select w from Wallet w where w.user.id = :userId and w.tenantId = :tenantId")
    Optional<Wallet> findByUserIdAndTenantId(@Param("userId") Long userId, @Param("tenantId") Long tenantId);
}
