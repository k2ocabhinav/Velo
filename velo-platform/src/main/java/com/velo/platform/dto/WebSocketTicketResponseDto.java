package com.velo.platform.dto;

public record WebSocketTicketResponseDto(String ticket, long expiresInSeconds) {
}
