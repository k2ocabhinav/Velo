package com.velo.platform.dto.admin;

import java.time.OffsetDateTime;
import java.util.List;

public record AdminLiveDispatchDto(
        OffsetDateTime generatedAt,
        List<AdminLiveDispatchDriverDto> drivers,
        List<AdminLiveDispatchRideDto> rides
) { }
