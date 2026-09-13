package com.babytracker.controller;

import com.babytracker.entity.GrowthRecord;
import com.babytracker.service.GrowthService;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/growth")
public class GrowthController {
    private final GrowthService service;
    public GrowthController(GrowthService service) { this.service = service; }
    @GetMapping public List<GrowthRecord> list() { return service.list(); }
    @PostMapping public GrowthRecord record(@RequestBody GrowthRecord record) { return service.record(record); }
}
