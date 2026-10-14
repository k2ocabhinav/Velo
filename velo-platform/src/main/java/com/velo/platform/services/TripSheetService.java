package com.velo.platform.services;

import com.velo.platform.dto.admin.TripSheetReasonRequestDto;
import com.velo.platform.dto.admin.TripSheetRowDto;

import java.time.LocalDate;
import java.util.List;

public interface TripSheetService {
    List<TripSheetRowDto> getTripSheet(LocalDate date, String assignmentFilter);
    List<TripSheetRowDto> getNeedsAttentionTrips();
    int getNeedsAttentionCount();
    int createUnassignedTripAlerts();
    byte[] exportCsv(LocalDate date);
    TripSheetRowDto cancel(Long rideRequestId, TripSheetReasonRequestDto request);
    TripSheetRowDto markNoShow(Long rideRequestId, TripSheetReasonRequestDto request);
}
