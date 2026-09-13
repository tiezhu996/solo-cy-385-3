package com.babytracker.controller;

import com.babytracker.entity.Baby;
import com.babytracker.service.BabyService;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/babies")
public class BabyController {
    private final BabyService service;
    public BabyController(BabyService service) { this.service = service; }
    @GetMapping public List<Baby> list() { return service.list(); }
    @PostMapping public Baby create(@RequestBody Baby baby) { return service.create(baby); }
}
