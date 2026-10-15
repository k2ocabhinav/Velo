package com.velo.platform.realtime;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.velo.platform.config.TestSecurityConfig;
import com.velo.platform.dto.RideUpdateEventDto;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.Ride;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.PaymentMethod;
import com.velo.platform.entities.enums.RideRequestStatus;
import com.velo.platform.entities.enums.RideStatus;
import com.velo.platform.entities.enums.Role;
import com.velo.platform.repositories.DriverRepository;
import com.velo.platform.repositories.RideRepository;
import com.velo.platform.repositories.RideRequestRepository;
import com.velo.platform.repositories.RiderRepository;
import com.velo.platform.repositories.UserRepository;
import com.velo.platform.security.JwtTokenProvider;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

import java.lang.reflect.Type;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles({"test", "test-security-bypass"})
@Import(TestSecurityConfig.class)
class RideRealtimeWebSocketIntegrationTest {

    private static final String RIDE_UPDATES_DESTINATION = "/user/queue/ride-updates";
    private static final String ALLOWED_ORIGIN = "http://localhost:3000";
    private static final Duration EVENT_TIMEOUT = Duration.ofSeconds(2);
    private static final int PUBLISH_ATTEMPTS = 5;

    @LocalServerPort
    private int port;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RiderRepository riderRepository;

    @Autowired
    private DriverRepository driverRepository;

    @Autowired
    private RideRepository rideRepository;

    @Autowired
    private RideRequestRepository rideRequestRepository;

    private User riderUser;
    private User driverUser;
    private Rider rider;
    private Driver driver;
    private RideRequest rideRequest;
    private Ride confirmedRide;

    @BeforeEach
    void setUp() {
        String suffix = UUID.randomUUID().toString();

        riderUser = userRepository.save(User.builder()
                .email("ws-rider-" + suffix + "@test.com")
                .password("password123")
                .firstName("Ws")
                .lastName("Rider")
                .roles(Set.of(Role.RIDER))
                .build());
        rider = riderRepository.save(Rider.builder().user(riderUser).rating(4.8).build());

        driverUser = userRepository.save(User.builder()
                .email("ws-driver-" + suffix + "@test.com")
                .password("password123")
                .firstName("Ws")
                .lastName("Driver")
                .roles(Set.of(Role.DRIVER))
                .build());
        driver = driverRepository.save(Driver.builder()
                .user(driverUser)
                .available(true)
                .rating(5.0)
                .vehicleId("KA01WS0001")
                .build());

        rideRequest = rideRequestRepository.save(RideRequest.builder()
                .rider(rider)
                .paymentMethod(PaymentMethod.WALLET)
                .rideRequestStatus(RideRequestStatus.CONFIRMED)
                .build());

        confirmedRide = rideRepository.save(Ride.builder()
                .rider(rider)
                .driver(driver)
                .rideStatus(RideStatus.CONFIRMED)
                .paymentMethod(PaymentMethod.WALLET)
                .fare(BigDecimal.valueOf(120.0))
                .otp("4321")
                .rideRequest(rideRequest)
                .build());
    }

    @AfterEach
    void tearDown() {
        if (confirmedRide != null) {
            rideRepository.deleteById(confirmedRide.getId());
        }
        if (rideRequest != null) {
            rideRequestRepository.deleteById(rideRequest.getId());
        }
        if (driver != null) {
            driverRepository.deleteById(driver.getId());
        }
        if (rider != null) {
            riderRepository.deleteById(rider.getId());
        }
        if (riderUser != null) {
            userRepository.deleteById(riderUser.getId());
        }
        if (driverUser != null) {
            userRepository.deleteById(driverUser.getId());
        }
    }

    @Test
    @DisplayName("Rider connected over STOMP receives driver location updates on /user/queue/ride-updates")
    void riderReceivesDriverLocationUpdateForConfirmedRide() throws Exception {
        WebSocketStompClient stompClient = new WebSocketStompClient(new StandardWebSocketClient());
        stompClient.setMessageConverter(new MappingJackson2MessageConverter(objectMapper));
        stompClient.setDefaultHeartbeat(new long[]{0, 0});

        String ticket = jwtTokenProvider.generateWebSocketTicket(
                riderUser.getEmail(), riderUser.getId(), Role.RIDER.name(), riderUser.getTenantId());

        WebSocketHttpHeaders handshakeHeaders = new WebSocketHttpHeaders();
        handshakeHeaders.setOrigin(ALLOWED_ORIGIN);
        StompHeaders connectHeaders = new StompHeaders();
        connectHeaders.add("Authorization", "Bearer " + ticket);

        StompSession session = stompClient.connectAsync(
                        "ws://localhost:" + port + "/ws/websocket",
                        handshakeHeaders,
                        connectHeaders,
                        new StompSessionHandlerAdapter() {
                        })
                .get(EVENT_TIMEOUT.toSeconds(), TimeUnit.SECONDS);

        try {
            BlockingQueue<RideUpdateEventDto> events = new LinkedBlockingQueue<>();
            session.subscribe(RIDE_UPDATES_DESTINATION, new StompFrameHandler() {
                @Override
                public Type getPayloadType(StompHeaders headers) {
                    return RideUpdateEventDto.class;
                }

                @Override
                public void handleFrame(StompHeaders headers, Object payload) {
                    events.add((RideUpdateEventDto) payload);
                }
            });

            RideUpdateEventDto event = awaitRideUpdate(events);

            assertThat(event.getEventType()).isEqualTo("DRIVER_LOCATION_UPDATED");
            assertThat(event.getRideId()).isEqualTo(confirmedRide.getId());
            assertThat(event.getRideRequestId()).isEqualTo(rideRequest.getId());
            assertThat(event.getRiderId()).isEqualTo(rider.getId());
            assertThat(event.getDriverId()).isEqualTo(driver.getId());
            assertThat(event.getStatus()).isEqualTo(RideStatus.CONFIRMED.name());
            assertThat(event.getDriverLocation()).isNotNull();
            assertThat(event.getDriverLocation().getLat()).isEqualTo(12.9716);
            assertThat(event.getDriverLocation().getLng()).isEqualTo(77.5946);
            assertThat(event.getDriverLocation().getCapturedAt()).isNotNull();
        } finally {
            session.disconnect();
        }
    }

    private RideUpdateEventDto awaitRideUpdate(BlockingQueue<RideUpdateEventDto> events) throws Exception {
        // The SUBSCRIBE frame reaches the broker asynchronously, so publish the driver location
        // again until the rider's subscription delivers the event.
        for (int attempt = 0; attempt < PUBLISH_ATTEMPTS; attempt++) {
            publishDriverLocationUpdate();
            RideUpdateEventDto event = events.poll(EVENT_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
            if (event != null) {
                return event;
            }
        }
        throw new AssertionError("No ride update received on " + RIDE_UPDATES_DESTINATION);
    }

    private void publishDriverLocationUpdate() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.add("X-Test-User-Id", String.valueOf(driverUser.getId()));
        headers.add("X-Test-Email", driverUser.getEmail());
        headers.add("X-Test-Role", "ROLE_" + Role.DRIVER.name());

        String body = """
                {
                  "lat": 12.9716,
                  "lng": 77.5946,
                  "heading": 45,
                  "speedKph": 22.5,
                  "accuracyM": 8
                }
                """;

        ResponseEntity<String> response = restTemplate.exchange(
                "/drivers/location", HttpMethod.PUT, new HttpEntity<>(body, headers), String.class);
        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
    }
}
