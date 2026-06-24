package com.ttrims.ims.repository;

import com.ttrims.ims.entity.OrderFollowUp;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface OrderFollowUpRepository extends JpaRepository<OrderFollowUp, String> {
    List<OrderFollowUp> findByOrderIdOrderByRecordedAtDesc(String orderId);
}
