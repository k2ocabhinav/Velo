package com.velo.platform.realtime;

import com.velo.platform.dto.NotificationDto;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.NotificationType;
import com.velo.platform.entities.enums.RideRequestStatus;
import com.velo.platform.repositories.NotificationRepository;
import com.velo.platform.repositories.UserRepository;
import com.velo.platform.services.NotificationService;
import com.velo.platform.services.RideRealtimeService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@SpringBootTest
@ActiveProfiles("test")
class RealtimeAfterCommitIntegrationTest {

    @Autowired private PlatformTransactionManager transactionManager;
    @Autowired private NotificationService notificationService;
    @Autowired private RideRealtimeService rideRealtimeService;
    @Autowired private UserRepository userRepository;
    @Autowired private NotificationRepository notificationRepository;
    @MockBean private SimpMessagingTemplate messagingTemplate;

    private User user;
    private RideRequest rideRequest;

    @BeforeEach
    void setUp() {
        user = userRepository.save(User.builder()
                .email("after-commit-" + System.nanoTime() + "@test.com")
                .password("password")
                .firstName("After")
                .lastName("Commit")
                .build());
        rideRequest = RideRequest.builder()
                .id(987654L)
                .rider(Rider.builder().id(123456L).user(user).build())
                .rideRequestStatus(RideRequestStatus.PENDING)
                .build();
    }

    @AfterEach
    void tearDown() {
        if (user != null) {
            notificationRepository.deleteAll(notificationRepository.findByUserOrderByCreatedTimeDesc(user));
            userRepository.delete(user);
        }
    }

    @Test
    void notificationAndRideEventsAreSuppressedOnRollbackAndDeliveredAfterCommit() {
        TransactionTemplate transaction = new TransactionTemplate(transactionManager);

        transaction.executeWithoutResult(status -> {
            publishNotificationAndRideUpdate();
            verifyNoInteractions(messagingTemplate);
            status.setRollbackOnly();
        });

        verifyNoInteractions(messagingTemplate);
        assertNoNotificationWasCommitted();

        transaction.executeWithoutResult(status -> {
            publishNotificationAndRideUpdate();
            verifyNoInteractions(messagingTemplate);
        });

        verify(messagingTemplate).convertAndSendToUser(
                eq(user.getEmail()),
                eq("/queue/notifications"),
                any(NotificationDto.class)
        );
        verify(messagingTemplate).convertAndSendToUser(
                eq(user.getEmail()),
                eq("/queue/ride-updates"),
                any()
        );
        assertThat(notificationRepository.findByUserOrderByCreatedTimeDesc(user)).hasSize(1);
    }

    private void publishNotificationAndRideUpdate() {
        notificationService.createNotification(
                user,
                "Ride requested",
                "A ride request is ready.",
                NotificationType.RIDE_REQUESTED,
                rideRequest.getId()
        );
        rideRealtimeService.publishRideRequestPending(rideRequest);
    }

    private void assertNoNotificationWasCommitted() {
        assertThat(notificationRepository.findByUserOrderByCreatedTimeDesc(user)).isEmpty();
    }
}
