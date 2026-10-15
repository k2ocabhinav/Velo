package com.velo.platform.services.impl;

import com.velo.platform.dto.NotificationDto;
import com.velo.platform.entities.Notification;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.NotificationType;
import com.velo.platform.exceptions.ResourceNotFoundException;
import com.velo.platform.exceptions.RuntimeConflictException;
import com.velo.platform.repositories.NotificationRepository;
import com.velo.platform.security.UserPrincipal;
import com.velo.platform.services.NotificationService;
import com.velo.platform.utils.UserDestinations;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
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
    private final ModelMapper modelMapper;

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
        NotificationDto dto = modelMapper.map(saved, NotificationDto.class);
        
        try {
            messagingTemplate.convertAndSendToUser(
                    UserDestinations.resolve(user),
                    "/queue/notifications",
                    dto
            );
            log.debug("Notification pushed to user {}: {}", user.getId(), title);
        } catch (Exception e) {
            log.error("Failed to push notification to user {}: {}", user.getId(), e.getMessage());
        }
        
        return dto;
    }

    @Override
    @Transactional(readOnly = true)
    public List<NotificationDto> getUserNotifications(User user) {
        return notificationRepository.findByUserOrderByCreatedTimeDesc(user)
                .stream()
                .map(n -> modelMapper.map(n, NotificationDto.class))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<NotificationDto> getUserNotifications(User user, Pageable pageable) {
        return notificationRepository.findByUser(user, pageable)
                .map(n -> modelMapper.map(n, NotificationDto.class));
    }

    @Override
    @Transactional
    public NotificationDto markAsRead(Long notificationId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found with id: " + notificationId));

        UserPrincipal principal = (UserPrincipal) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (!notification.getUser().getId().equals(principal.getUserId())) {
            throw new RuntimeConflictException("You do not have permission to modify this notification");
        }
        if (!resolveTenantId(notification.getTenantId()).equals(resolveTenantId(principal.getTenantId()))) {
            throw new RuntimeConflictException("Cross-tenant notification access is not allowed.");
        }

        notification.setRead(true);
        Notification saved = notificationRepository.save(notification);
        return modelMapper.map(saved, NotificationDto.class);
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
