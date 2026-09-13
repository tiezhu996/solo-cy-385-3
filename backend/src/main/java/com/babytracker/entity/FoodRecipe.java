package com.babytracker.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("food_recipe")
public class FoodRecipe {
    private Long id;
    private Integer monthAgeMin;
    private Integer monthAgeMax;
    private String name;
    private String ingredients;
    private String steps;
    private String nutrition;
    private String allergens;
}
