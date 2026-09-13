package com.babytracker.utils;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class JwtUtil {
    @Value("${jwt.secret}")
    private String secret;
    public String demoToken(Long userId) { return userId + "." + secret.hashCode(); }
}
