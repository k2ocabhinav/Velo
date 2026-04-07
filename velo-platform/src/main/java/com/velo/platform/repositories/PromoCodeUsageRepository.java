package com.velo.platform.repositories;

import com.velo.platform.entities.PromoCode;
import com.velo.platform.entities.PromoCodeUsage;
import com.velo.platform.entities.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PromoCodeUsageRepository extends JpaRepository<PromoCodeUsage, Long> {
    boolean existsByPromoCodeAndUser(PromoCode promoCode, User user);
    int countByPromoCode(PromoCode promoCode);
}
