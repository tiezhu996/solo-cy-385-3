package com.babytracker.service;

import com.babytracker.entity.Baby;
import com.babytracker.mapper.BabyMapper;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class BabyService {
    private final BabyMapper mapper;
    public BabyService(BabyMapper mapper) { this.mapper = mapper; }
    public Baby create(Baby baby) { mapper.insert(baby); return baby; }
    public List<Baby> list() { return mapper.selectList(null); }
}
