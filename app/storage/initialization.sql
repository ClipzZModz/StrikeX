CREATE TABLE IF NOT EXISTS `users`
(
    `id` INT NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `first_name` VARCHAR(255) NULL default NULL,
    `last_name` VARCHAR(255) NULL default NULL,
    `company` VARCHAR(255) NULL default NULL,
    `ip_address` VARCHAR(255) NOT NULL,
    `created_at` VARCHAR(255) NOT NULL,
    `auth` VARCHAR(255) NOT NULL default 'user',
    stripe_customer_id VARCHAR(255) NULL,
    PRIMARY KEY (`id`)
);


CREATE TABLE IF NOT EXISTS `api_keys`
(
    `id` INT NOT NULL AUTO_INCREMENT,
    `user_id` INT NOT NULL,
    `access` VARCHAR(255) NOT NULL,
    `authorised_urls` LONGTEXT NOT NULL,
    `date` VARCHAR(255) NOT NULL,
    `ttl` VARCHAR(255) NOT NULL,
    `status` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `sessions` (
    `session_id` VARCHAR(128) NOT NULL,
    `expires` INT UNSIGNED NOT NULL,
    `data` MEDIUMTEXT,
    PRIMARY KEY (`session_id`)
);

CREATE TABLE IF NOT EXISTS `carts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `session_id` VARCHAR(255),
    `user_id` INT,
    `cart_items` LONGTEXT DEFAULT null,
    `last_updated` VARCHAR(255),
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS `products`
(
    `id` INT NOT NULL AUTO_INCREMENT,
    `sku` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `category` VARCHAR(255) NOT NULL,
    `quantity` INT NOT NULL,
    `quantity_sold` INT NOT NULL,
    `description` LONGTEXT NOT NULL,
    `uk_price_obj` LONGTEXT NOT NULL,
    `images` LONGTEXT NOT NULL,
    `status` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`)
);


CREATE TABLE IF NOT EXISTS `orders` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `user_id` INT,
    `cart_id` INT,
    `order_items` LONGTEXT NOT NULL,
    `subtotal_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `discount_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `shipping_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `total_amount` DECIMAL(10, 2) NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'GBP',
    `coupon_code` VARCHAR(64) NULL DEFAULT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
    `payment_method` VARCHAR(50),
    `payment_status` VARCHAR(50) NOT NULL DEFAULT 'unpaid',
    `payment_id` VARCHAR(255),
    `shipping_address` LONGTEXT,
    `customer_notes` LONGTEXT,
    `staff_notes` LONGTEXT NULL DEFAULT NULL,
    `confirmation_seen` TINYINT(1) NOT NULL DEFAULT 0,
    `shipping_carrier` VARCHAR(64) NULL DEFAULT NULL,
    `tracking_number` VARCHAR(128) NULL DEFAULT NULL,
    `tracking_url` VARCHAR(512) NULL DEFAULT NULL,
    `shipping_eta_start` DATE NULL DEFAULT NULL,
    `shipping_eta_end` DATE NULL DEFAULT NULL,
    `processing_at` DATETIME NULL DEFAULT NULL,
    `shipped_at` DATETIME NULL DEFAULT NULL,
    `delivered_at` DATETIME NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
);



CREATE TABLE IF NOT EXISTS `addresses` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `user_id` INT NOT NULL,
    `full_name` VARCHAR(255) NOT NULL,
    `phone_number` VARCHAR(20),
    `address_line1` VARCHAR(255) NOT NULL,
    `address_line2` VARCHAR(255),
    `city` VARCHAR(100) NOT NULL,
    `region` VARCHAR(100),
    `postal_code` VARCHAR(20) NOT NULL,
    `country` VARCHAR(100) NOT NULL DEFAULT 'United Kingdom',
    `is_default` BOOLEAN NOT NULL DEFAULT FALSE,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `coupons` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(64) NOT NULL,
    `percent_off` INT NOT NULL,
    `min_subtotal` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `active` BOOLEAN NOT NULL DEFAULT TRUE,
    `starts_at` DATETIME NULL DEFAULT NULL,
    `ends_at` DATETIME NULL DEFAULT NULL,
    `usage_limit` INT NULL DEFAULT NULL,
    `times_used` INT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_coupon_code` (`code`)
);
