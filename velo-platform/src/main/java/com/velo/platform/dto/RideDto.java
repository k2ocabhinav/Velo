package com.velo.platform.dto;

import com.velo.platform.entities.enums.PaymentMethod;
import com.velo.platform.entities.enums.RideStatus;
import lombok.Data;
import org.locationtech.jts.geom.Point;

import java.time.LocalDateTime;

@Data
public class RideDto {

    private Long id;
    private PointDto pickupLocation;
    private PointDto dropOffLocation;
    private LocalDateTime createdTime;
    private LocalDateTime startedAt;
    private LocalDateTime endedAt;

    private RiderDto rider;
    private DriverDto driver;

    private PaymentMethod paymentMethod;
    private RideStatus rideStatus;
    private Double fare;
    private String promoCode;
    private Double discountAmount;

    /** True once the rider has rated this ride's driver. */
    private boolean driverRated;

    /** True once the driver has rated this ride's rider. */
    private boolean riderRated;
}
