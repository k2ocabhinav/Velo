package com.velo.platform.services.impl;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RefreshTokenReplayCipherTest {

    @Test
    void encryptsAndAuthenticatesTheExactSuccessorPair() {
        RefreshTokenReplayCipher cipher = new RefreshTokenReplayCipher("test signing secret");

        String encrypted = cipher.encrypt("header.payload.signature", "opaque-refresh-token");
        RefreshTokenReplayCipher.ReplayResponse replay = cipher.decrypt(encrypted);

        assertThat(encrypted).doesNotContain("opaque-refresh-token", "header.payload.signature");
        assertThat(replay.accessToken()).isEqualTo("header.payload.signature");
        assertThat(replay.refreshToken()).isEqualTo("opaque-refresh-token");
        char replacement = encrypted.charAt(16) == 'A' ? 'B' : 'A';
        String tampered = encrypted.substring(0, 16) + replacement + encrypted.substring(17);
        assertThatThrownBy(() -> cipher.decrypt(tampered))
                .isInstanceOf(IllegalStateException.class);
    }
}
