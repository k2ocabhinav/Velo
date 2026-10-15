package com.velo.platform.dto.admin;

import java.time.LocalDateTime;
import java.util.List;

public record AdminLiveDispatchDto(
        LocalDateTime generatedAt,
        List<AdminLiveDispatchDriverDto> drivers,
        List<AdminLiveDispatchRideDto> rides
) { }
