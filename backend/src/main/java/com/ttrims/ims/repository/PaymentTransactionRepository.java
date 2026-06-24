package com.ttrims.ims.repository;

import com.ttrims.ims.entity.PaymentTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, String> {
    List<PaymentTransaction> findByOrderIdOrderByRecordedAtAsc(String orderId);
}
