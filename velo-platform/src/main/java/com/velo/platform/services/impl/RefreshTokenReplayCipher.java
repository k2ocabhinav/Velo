package com.velo.platform.services.impl;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/** Encrypts the short-lived rotation response kept for cross-instance retry replay. */
@Component
public class RefreshTokenReplayCipher {

    private static final byte[] KEY_DERIVATION_PREFIX =
            "velo:refresh-token:rotation-replay:".getBytes(StandardCharsets.UTF_8);
    private static final int NONCE_LENGTH_BYTES = 12;
    private static final int AUTH_TAG_LENGTH_BITS = 128;

    private final SecretKeySpec key;
    private final SecureRandom secureRandom = new SecureRandom();

    public RefreshTokenReplayCipher(@Value("${jwt.secret}") String jwtSecret) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update(KEY_DERIVATION_PREFIX);
            this.key = new SecretKeySpec(digest.digest(jwtSecret.getBytes(StandardCharsets.UTF_8)), "AES");
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("Unable to initialize refresh-token response encryption", exception);
        }
    }

    public String encrypt(String accessToken, String refreshToken) {
        byte[] nonce = new byte[NONCE_LENGTH_BYTES];
        secureRandom.nextBytes(nonce);
        byte[] plaintext = (accessToken + "\n" + refreshToken).getBytes(StandardCharsets.UTF_8);
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(AUTH_TAG_LENGTH_BITS, nonce));
            byte[] ciphertext = cipher.doFinal(plaintext);
            return Base64.getUrlEncoder().withoutPadding().encodeToString(
                    ByteBuffer.allocate(nonce.length + ciphertext.length).put(nonce).put(ciphertext).array());
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("Unable to encrypt refresh-token rotation response", exception);
        }
    }

    public ReplayResponse decrypt(String encryptedResponse) {
        byte[] payload;
        try {
            payload = Base64.getUrlDecoder().decode(encryptedResponse);
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("Invalid encrypted refresh-token rotation response", exception);
        }
        if (payload.length <= NONCE_LENGTH_BYTES) {
            throw new IllegalStateException("Invalid encrypted refresh-token rotation response");
        }

        byte[] nonce = new byte[NONCE_LENGTH_BYTES];
        byte[] ciphertext = new byte[payload.length - NONCE_LENGTH_BYTES];
        ByteBuffer.wrap(payload).get(nonce).get(ciphertext);
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(AUTH_TAG_LENGTH_BITS, nonce));
            String plaintext = new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
            int separator = plaintext.indexOf('\n');
            if (separator <= 0 || separator == plaintext.length() - 1) {
                throw new IllegalStateException("Invalid encrypted refresh-token rotation response");
            }
            return new ReplayResponse(plaintext.substring(0, separator), plaintext.substring(separator + 1));
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("Unable to decrypt refresh-token rotation response", exception);
        }
    }

    public record ReplayResponse(String accessToken, String refreshToken) { }
}
