package com.babytracker.service;

import com.babytracker.entity.GrowthRecord;
import com.babytracker.mapper.GrowthMapper;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class GrowthService {
    private final GrowthMapper mapper;
    public GrowthService(GrowthMapper mapper) { this.mapper = mapper; }
    public GrowthRecord record(GrowthRecord record) {
        record.setPercentile(record.getWeightKg() != null && record.getWeightKg() > 9 ? "P75" : "P50");
        mapper.insert(record);
        return record;
    }
    public List<GrowthRecord> list() { return mapper.selectList(null); }
}
