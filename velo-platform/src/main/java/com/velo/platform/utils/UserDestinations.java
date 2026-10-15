package com.velo.platform.utils;

import com.velo.platform.entities.User;

/**
 * STOMP user destination names are emails, because {@code UserPrincipal#getName()} returns the
 * email — so {@code convertAndSendToUser} must always target the email, never the user id.
 */
public final class UserDestinations {

    private UserDestinations() {
    }

    public static String resolve(User user) {
        return user.getEmail();
    }
}
