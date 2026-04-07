package com.velo.platform.services;

import com.velo.platform.dto.NotificationDto;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.NotificationType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface NotificationService {
    NotificationDto createNotification(User user, String title, String message, NotificationType type, Long referenceId);
    List<NotificationDto> getUserNotifications(User user);
    Page<NotificationDto> getUserNotifications(User user, Pageable pageable);
    NotificationDto markAsRead(Long notificationId);
    void markAllAsRead(User user);
    long getUnreadCount(User user);
}
