package com.babytracker.controller;

import com.babytracker.entity.VaccineRecord;
import com.babytracker.service.VaccineService;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/vaccines")
public class VaccineController {
    private final VaccineService service;
    public VaccineController(VaccineService service) { this.service = service; }
    @GetMapping public List<VaccineRecord> schedule() { return service.schedule(); }
    @PostMapping public VaccineRecord save(@RequestBody VaccineRecord record) { return service.save(record); }
}
