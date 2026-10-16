package com.velo.platform.services.impl;

import com.velo.platform.dto.NotificationDto;
import com.velo.platform.entities.Notification;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.NotificationType;
import com.velo.platform.exceptions.ResourceNotFoundException;
import com.velo.platform.repositories.NotificationRepository;
import com.velo.platform.security.UserPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationServiceImplTest {

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private NotificationServiceImpl notificationService;

    private User testUser;
    private Notification testNotification;

    @BeforeEach
    void setUp() {
        testUser = User.builder().id(1L).email("user@test.com").build();
        testNotification = Notification.builder()
                .id(101L)
                .user(testUser)
                .title("Test Notification")
                .read(false)
                .build();
    }

    private void mockSecurityContext(Long userId) {
        UserPrincipal principal = new UserPrincipal(userId, "user@test.com", "password");
        Authentication authentication = mock(Authentication.class);
        when(authentication.getPrincipal()).thenReturn(principal);
        SecurityContext securityContext = mock(SecurityContext.class);
        when(securityContext.getAuthentication()).thenReturn(authentication);
        SecurityContextHolder.setContext(securityContext);
    }

    @Test
    @DisplayName("Create notification should save and push")
    void createNotification_ShouldSaveAndPush() {
        when(notificationRepository.save(any(Notification.class))).thenReturn(testNotification);
        notificationService.createNotification(testUser, "Title", "Message", NotificationType.RIDE_REQUESTED, 1L);

        verify(notificationRepository).save(any(Notification.class));
        verify(messagingTemplate).convertAndSendToUser(eq("user@test.com"), eq("/queue/notifications"), any(NotificationDto.class));
    }

    @Test
    @DisplayName("Mark as read with correct ownership should succeed")
    void markAsRead_WithOwner_ShouldSucceed() {
        mockSecurityContext(1L);
        when(notificationRepository.findById(101L)).thenReturn(Optional.of(testNotification));
        when(notificationRepository.save(any(Notification.class))).thenReturn(testNotification);
        notificationService.markAsRead(101L);

        assertThat(testNotification.getRead()).isTrue();
        verify(notificationRepository).save(testNotification);
    }

    @Test
    @DisplayName("Mark as read by a different user in the same tenant should be forbidden")
    void markAsRead_ByNonOwner_ShouldThrowForbidden() {
        mockSecurityContext(99L); // Different user
        when(notificationRepository.findById(101L)).thenReturn(Optional.of(testNotification));

        assertThatThrownBy(() -> notificationService.markAsRead(101L))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class)
                .hasMessageContaining("You do not have permission");
    }

    @Test
    @DisplayName("Mark as read for another tenant's notification should report not found")
    void markAsRead_CrossTenant_ShouldReportNotFound() {
        testNotification.setTenantId(2L);
        mockSecurityContext(1L); // principal tenant 1
        when(notificationRepository.findById(101L)).thenReturn(Optional.of(testNotification));

        assertThatThrownBy(() -> notificationService.markAsRead(101L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Notification not found");
    }

    @Test
    @DisplayName("Mark as read for non-existent notification should throw ResourceNotFoundException")
    void markAsRead_NonExistent_ShouldThrowException() {
        when(notificationRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> notificationService.markAsRead(999L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Notification not found");
    }
}
