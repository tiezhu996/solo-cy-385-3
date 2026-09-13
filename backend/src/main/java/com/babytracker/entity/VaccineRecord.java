package com.babytracker.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDate;

@Data
@TableName("vaccine_record")
public class VaccineRecord {
    private Long id;
    private Long babyId;
    private String vaccineName;
    private LocalDate plannedDate;
    private Boolean completed;
}
