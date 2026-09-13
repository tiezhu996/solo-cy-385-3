package com.babytracker.exception;

import com.babytracker.constants.ErrorCode;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(BizException.class)
    public Map<String, Object> handleBiz(BizException ex) {
        return Map.of("success", false, "code", ex.getCode(), "message", ex.getMessage());
    }
    @ExceptionHandler(Exception.class)
    public Map<String, Object> handle(Exception ex) {
        return Map.of("success", false, "code", ErrorCode.INTERNAL_ERROR, "message", "服务器内部错误");
    }
}
