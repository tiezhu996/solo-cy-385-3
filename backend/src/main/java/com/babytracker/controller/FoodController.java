package com.babytracker.controller;

import com.babytracker.entity.FoodRecipe;
import com.babytracker.service.FoodService;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/foods")
public class FoodController {
    private final FoodService service;
    public FoodController(FoodService service) { this.service = service; }
    @GetMapping("/recommend") public List<FoodRecipe> recommend(@RequestParam Integer monthAge, @RequestParam(required = false) String allergen) { return service.recommend(monthAge, allergen); }
}
