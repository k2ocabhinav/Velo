package com.velo.platform.repositories;

import com.velo.platform.entities.PromoCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PromoCodeRepository extends JpaRepository<PromoCode, Long> {
    Optional<PromoCode> findByCode(String code);
    boolean existsByCode(String code);
    java.util.List<PromoCode> findByActiveTrue();
}
