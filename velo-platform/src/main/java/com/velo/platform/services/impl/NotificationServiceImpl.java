package com.velo.platform.services.impl;

import com.velo.platform.dto.NotificationDto;
import com.velo.platform.entities.Notification;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.NotificationType;
import com.velo.platform.exceptions.ResourceNotFoundException;
import com.velo.platform.repositories.NotificationRepository;
import com.velo.platform.security.UserPrincipal;
import com.velo.platform.services.NotificationService;
import com.velo.platform.utils.AfterCommit;
import com.velo.platform.utils.UserDestinations;
import com.velo.platform.utils.UtcTimes;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationServiceImpl implements NotificationService {

    private final NotificationRepository notificationRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Override
    @Transactional
    public NotificationDto createNotification(User user, String title, String message,
                                           NotificationType type, Long referenceId) {
        Notification notification = Notification.builder()
                .tenantId(user.getTenantId() == null ? 1L : user.getTenantId())
                .user(user)
                .title(title)
                .message(message)
                .type(type)
                .referenceId(referenceId)
                .read(false)
                .build();

        Notification saved = notificationRepository.save(notification);
        NotificationDto dto = toDto(saved);

        String destination = UserDestinations.resolve(user);
        Long userId = user.getId();
        AfterCommit.run(() -> publishNotification(destination, userId, title, dto));

        return dto;
    }

    private void publishNotification(String destination, Long userId, String title, NotificationDto dto) {
        try {
            messagingTemplate.convertAndSendToUser(
                    destination,
                    "/queue/notifications",
                    dto
            );
            log.debug("Notification pushed to user {}: {}", userId, title);
        } catch (Exception e) {
            log.error("Failed to push notification to user {}: {}", userId, e.getMessage());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<NotificationDto> getUserNotifications(User user) {
        return notificationRepository.findByUserOrderByCreatedTimeDesc(user)
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<NotificationDto> getUserNotifications(User user, Pageable pageable) {
        return notificationRepository.findByUser(user, pageable)
                .map(this::toDto);
    }

    @Override
    @Transactional
    public NotificationDto markAsRead(Long notificationId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found with id: " + notificationId));

        UserPrincipal principal = (UserPrincipal) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        // A notification in another tenant must not reveal that it exists.
        if (!resolveTenantId(notification.getTenantId()).equals(resolveTenantId(principal.getTenantId()))) {
            throw new ResourceNotFoundException("Notification not found with id: " + notificationId);
        }
        if (!notification.getUser().getId().equals(principal.getUserId())) {
            throw new AccessDeniedException("You do not have permission to modify this notification");
        }

        notification.setRead(true);
        Notification saved = notificationRepository.save(notification);
        return toDto(saved);
    }

    private NotificationDto toDto(Notification notification) {
        return NotificationDto.builder()
                .id(notification.getId())
                .title(notification.getTitle())
                .message(notification.getMessage())
                .type(notification.getType())
                .referenceId(notification.getReferenceId())
                .read(notification.getRead())
                .createdTime(UtcTimes.toOffsetDateTime(notification.getCreatedTime()))
                .build();
    }

    @Override
    @Transactional
    public void markAllAsRead(User user) {
        notificationRepository.markAllAsReadByUser(user);
    }

    @Override
    @Transactional(readOnly = true)
    public long getUnreadCount(User user) {
        return notificationRepository.countByUserAndReadFalse(user);
    }

    private Long resolveTenantId(Long tenantId) {
        return tenantId == null ? 1L : tenantId;
    }
}
