package com.babytracker.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.babytracker.entity.FoodRecipe;
import com.babytracker.mapper.FoodMapper;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class FoodService {
    private final FoodMapper mapper;
    public FoodService(FoodMapper mapper) { this.mapper = mapper; }
    public List<FoodRecipe> recommend(Integer monthAge, String allergen) {
        QueryWrapper<FoodRecipe> query = new QueryWrapper<FoodRecipe>().le("month_age_min", monthAge).ge("month_age_max", monthAge);
        if (allergen != null && !allergen.isBlank()) query.notLike("allergens", allergen);
        return mapper.selectList(query);
    }
}
