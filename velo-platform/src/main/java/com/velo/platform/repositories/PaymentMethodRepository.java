package com.velo.platform.repositories;

import com.velo.platform.entities.PaymentMethodEntity;
import com.velo.platform.entities.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentMethodRepository extends JpaRepository<PaymentMethodEntity, Long> {
    List<PaymentMethodEntity> findByUser(User user);

    List<PaymentMethodEntity> findByUserId(Long userId);

    Optional<PaymentMethodEntity> findByIdAndUser(Long id, User user);

    Optional<PaymentMethodEntity> findByIdAndUserId(Long id, Long userId);

    List<PaymentMethodEntity> findByUserAndIsDefaultTrue(User user);
}