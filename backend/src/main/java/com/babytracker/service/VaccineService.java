package com.babytracker.service;

import com.babytracker.entity.VaccineRecord;
import com.babytracker.mapper.VaccineMapper;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class VaccineService {
    private final VaccineMapper mapper;
    public VaccineService(VaccineMapper mapper) { this.mapper = mapper; }
    public List<VaccineRecord> schedule() { return mapper.selectList(null); }
    public VaccineRecord save(VaccineRecord record) { mapper.insert(record); return record; }
}
