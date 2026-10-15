package com.velo.platform.dto.admin;

public record AdminLiveDispatchLocationDto(
        Double lat,
        Double lng,
        String address
) { }
