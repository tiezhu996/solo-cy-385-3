package com.babytracker;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("com.babytracker.mapper")
public class BabyTrackerApplication {
    public static void main(String[] args) {
        SpringApplication.run(BabyTrackerApplication.class, args);
    }
}
