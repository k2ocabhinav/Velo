package com.velo.platform.services.impl;

import com.velo.platform.dto.PayoutRequestDto;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.PayoutRequest;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.PayoutStatus;
import com.velo.platform.entities.enums.TransactionMethod;
import com.velo.platform.exceptions.RuntimeConflictException;
import com.velo.platform.exceptions.ResourceNotFoundException;
import com.velo.platform.repositories.DriverRepository;
import com.velo.platform.repositories.PayoutRequestRepository;
import com.velo.platform.security.UserPrincipal;
import com.velo.platform.services.DriverEarningsService;
import com.velo.platform.services.WalletService;
import com.velo.platform.services.TenantScopeService;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.PageImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PayoutServiceImplTest {

    @Mock
    private PayoutRequestRepository payoutRequestRepository;

    @Mock
    private DriverEarningsService driverEarningsService;

    @Mock
    private DriverRepository driverRepository;

    @Mock
    private WalletService walletService;

    @Mock
    private ModelMapper modelMapper;

    @Mock
    private TenantScopeService tenantScopeService;

    @InjectMocks
    private PayoutServiceImpl payoutService;

    private Driver driver;
    private User user;

    @BeforeEach
    void setUp() {
        lenient().when(tenantScopeService.requireCurrentTenantId()).thenReturn(1L);
        user = new User();
        user.setId(101L);

        driver = new Driver();
        driver.setId(1L);
        driver.setUser(user);
    }

    private void mockSecurityContext() {
        UserPrincipal principal = new UserPrincipal(101L, "user@test.com", "password");
        Authentication authentication = mock(Authentication.class);
        when(authentication.getPrincipal()).thenReturn(principal);
        SecurityContext securityContext = mock(SecurityContext.class);
        when(securityContext.getAuthentication()).thenReturn(authentication);
        SecurityContextHolder.setContext(securityContext);

        when(driverRepository.findByUserIdAndTenantId(101L, 1L)).thenReturn(Optional.of(driver));
    }

    @Test
    void requestPayout_ShouldSuccess_WhenBalanceIsSufficient() {
        mockSecurityContext();
        when(driverEarningsService.getAvailableBalance()).thenReturn(BigDecimal.valueOf(500.0));

        PayoutRequest savedRequest = new PayoutRequest();
        savedRequest.setId(1L);
        savedRequest.setStatus(PayoutStatus.PENDING);
        savedRequest.setAmount(BigDecimal.valueOf(100.0));

        PayoutRequestDto expectedDto = new PayoutRequestDto();
        expectedDto.setStatus(PayoutStatus.PENDING);

        when(payoutRequestRepository.save(any(PayoutRequest.class))).thenReturn(savedRequest);
        when(modelMapper.map(savedRequest, PayoutRequestDto.class)).thenReturn(expectedDto);

        PayoutRequestDto result = payoutService.requestPayout(BigDecimal.valueOf(100.0));

        assertThat(result.getStatus()).isEqualTo(PayoutStatus.PENDING);
        verify(payoutRequestRepository).save(argThat(req -> 
            req.getAmount().compareTo(BigDecimal.valueOf(100.0)) == 0 && 
            req.getStatus() == PayoutStatus.PENDING));
    }

    @Test
    void requestPayout_ShouldThrowException_WhenBalanceIsInsufficient() {
        when(driverEarningsService.getAvailableBalance()).thenReturn(BigDecimal.valueOf(50.0));

        RuntimeException ex = assertThrows(RuntimeConflictException.class, () -> {
            payoutService.requestPayout(BigDecimal.valueOf(100.0));
        });

        assertThat(ex.getMessage()).isEqualTo("Insufficient earnings balance for payout request");
        verifyNoInteractions(payoutRequestRepository);
    }

    @Test
    void processPayout_ShouldTransferMoneyAndMarkAsProcessed() {
        PayoutRequest request = new PayoutRequest();
        request.setId(1L);
        request.setDriver(driver);
        request.setAmount(BigDecimal.valueOf(200.0));
        request.setStatus(PayoutStatus.APPROVED);

        when(payoutRequestRepository.findByIdAndTenantIdForUpdate(1L, 1L)).thenReturn(Optional.of(request));
        
        PayoutRequestDto expectedDto = new PayoutRequestDto();
        expectedDto.setStatus(PayoutStatus.PROCESSED);
        
        when(payoutRequestRepository.save(request)).thenReturn(request);
        when(modelMapper.map(request, PayoutRequestDto.class)).thenReturn(expectedDto);

        PayoutRequestDto result = payoutService.processPayout(1L);

        assertThat(result.getStatus()).isEqualTo(PayoutStatus.PROCESSED);
        verify(walletService).addMoneyToWallet(eq(user), eq(BigDecimal.valueOf(200.0)), anyString(), isNull(), eq(TransactionMethod.BANKING));
        verify(payoutRequestRepository).findByIdAndTenantIdForUpdate(1L, 1L);
        assertThat(request.getStatus()).isEqualTo(PayoutStatus.PROCESSED);
    }

    @Test
    void approvePayout_CrossTenantRequest_ShouldReturnNotFound() {
        when(payoutRequestRepository.findByIdAndTenantIdForUpdate(2L, 1L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> payoutService.approvePayout(2L, "approved"));

        verifyNoInteractions(walletService);
    }

    @Test
    void processPayout_CrossTenantRequest_ShouldReturnNotFoundWithoutCredit() {
        when(payoutRequestRepository.findByIdAndTenantIdForUpdate(2L, 1L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> payoutService.processPayout(2L));

        verifyNoInteractions(walletService);
    }

    @Test
    void rejectPayout_CrossTenantRequest_ShouldReturnNotFound() {
        when(payoutRequestRepository.findByIdAndTenantIdForUpdate(2L, 1L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> payoutService.rejectPayout(2L, "rejected"));
    }

    @Test
    void getPendingPayouts_ShouldUseCurrentTenant() {
        PageRequest pageRequest = PageRequest.of(0, 10);
        when(payoutRequestRepository.findByTenantIdAndStatusOrderByRequestedAtAsc(1L, PayoutStatus.PENDING, pageRequest))
                .thenReturn(new PageImpl<>(java.util.List.of()));

        payoutService.getPendingPayouts(pageRequest);

        verify(payoutRequestRepository).findByTenantIdAndStatusOrderByRequestedAtAsc(
                1L, PayoutStatus.PENDING, pageRequest);
    }
}
