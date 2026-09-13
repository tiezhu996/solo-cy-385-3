package com.babytracker.controller;

import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {
    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, String> body) {
        return Map.of("token", "demo-token", "user", Map.of("nickname", body.getOrDefault("nickname", "新手父母")));
    }
}
