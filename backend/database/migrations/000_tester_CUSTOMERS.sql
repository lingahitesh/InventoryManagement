INSERT INTO customers
(customer_id,fname,mname,lname,contact,email,address,pincode,city,state,gst)
VALUES
(1,'Rajesh',NULL,'Sharma',
'9876543210',
'rajesh@gmail.com',
'15 Park Street',
700016,
'Kolkata',
'West Bengal',
'19ABCDE1234F1Z5');

INSERT INTO customers
(customer_id,fname,mname,lname,contact,email,address,pincode,city,state,gst)
VALUES
(2,'Amit','Kumar','Gupta',
'9812345678, 9876541230',
'amit@gmail.com, accounts@amit.com',
'22 MG Road',
560001,
'Bengaluru',
'Karnataka',
'29ABCDE1234F2Z6');

INSERT INTO customers
(customer_id,fname,mname,lname,contact,email,address,pincode,city,state,gst)
VALUES
(3,'Priya',NULL,'Verma',
'9900123456, 9988776655, 9123456789',
'priya@gmail.com',
'44 Ring Road',
110001,
'Delhi',
'Delhi',
'07ABCDE1234F3Z7');

INSERT INTO customers
(customer_id,fname,mname,lname,contact,email,address,pincode,city,state,gst)
VALUES
(4,'Sanjay','K','Agarwal',
'9876501234',
'sanjay@gmail.com, dispatch@sanjay.com',
'8 Civil Lines',
226001,
'Lucknow',
'Uttar Pradesh',
'09ABCDE1234F4Z8');

INSERT INTO customers
(customer_id,fname,mname,lname,contact,email,address,pincode,city,state,gst)
VALUES
(5,'Rohit',NULL,'Jain',
'9123456789, 9898989898',
'rohit@gmail.com, purchase@rohit.com, accounts@rohit.com',
'12 Market Road',
452001,
'Indore',
'Madhya Pradesh',
'23ABCDE1234F5Z9');

INSERT INTO customers
(customer_id,fname,mname,lname,contact,email,address,pincode,city,state,gst)
VALUES
(6,'Ankit','Raj','Mehta',
'9876123450',
NULL,
'17 Station Road',
395003,
'Surat',
'Gujarat',
'24ABCDE1234F6Z1');

INSERT INTO customers
(customer_id,fname,mname,lname,contact,email,address,pincode,city,state,gst)
VALUES
(7,'Vikas',NULL,'Singh',
'9898001234, 9811112233',
'sales@vikas.com',
'91 GT Road',
141001,
'Ludhiana',
'Punjab',
'03ABCDE1234F7Z2');

INSERT INTO customers
(customer_id,fname,mname,lname,contact,email,address,pincode,city,state,gst)
VALUES
(8,'Neha','R','Kapoor',
'9000011111',
'neha@gmail.com, office@neha.com',
'56 Residency Road',
302001,
'Jaipur',
'Rajasthan',
'08ABCDE1234F8Z3');

INSERT INTO customers
(customer_id,fname,mname,lname,contact,email,address,pincode,city,state,gst)
VALUES
(9,'Pooja',NULL,'Bansal',
'9334455667, 9445566778',
'pooja@gmail.com, admin@pooja.com, support@pooja.com',
'34 Lake View',
600001,
'Chennai',
'Tamil Nadu',
'33ABCDE1234F9Z4');

INSERT INTO customers
(customer_id,fname,mname,lname,contact,email,address,pincode,city,state,gst)
VALUES
(10,'Arjun','S','Patel',
'9887766554',
'arjun@gmail.com',
'76 SG Highway',
380015,
'Ahmedabad',
'Gujarat',
'24ABCDE1234F1Z5');


INSERT INTO customer_shipping_addresses
(customer_id, address, pincode, city, state, is_default) VALUES
(1,'15 Park Street',700016,'Kolkata','West Bengal',1);

INSERT INTO customer_shipping_addresses
(customer_id, address, pincode, city, state, is_default) VALUES
(2,'22 MG Road',560001,'Bengaluru','Karnataka',1);
INSERT INTO customer_shipping_addresses
(customer_id, address, pincode, city, state, is_default) VALUES
(2,'Peenya Industrial Area',560058,'Bengaluru','Karnataka',0);

INSERT INTO customer_shipping_addresses
(customer_id, address, pincode, city, state, is_default) VALUES
(3,'44 Ring Road',110001,'Delhi','Delhi',1);
INSERT INTO customer_shipping_addresses
(customer_id, address, pincode, city, state, is_default) VALUES
(3,'Noida Sector 62',201309,'Noida','Uttar Pradesh',0);

INSERT INTO customer_shipping_addresses
(customer_id, address, pincode, city, state, is_default) VALUES
(4,'8 Civil Lines',226001,'Lucknow','Uttar Pradesh',1);
INSERT INTO customer_shipping_addresses
(customer_id, address, pincode, city, state, is_default) VALUES
(4,'Kanpur Warehouse',208001,'Kanpur','Uttar Pradesh',0);

INSERT INTO customer_shipping_addresses
(customer_id, address, pincode, city, state, is_default) VALUES
(5,'12 Market Road',452001,'Indore','Madhya Pradesh',1);
INSERT INTO customer_shipping_addresses
(customer_id, address, pincode, city, state, is_default) VALUES
(5,'Pithampur Industrial Area',454775,'Dhar','Madhya Pradesh',0);
INSERT INTO customer_shipping_addresses
(customer_id, address, pincode, city, state, is_default) VALUES
(5,'Bhopal Depot',462001,'Bhopal','Madhya Pradesh',0);

INSERT INTO customer_shipping_addresses
(customer_id, address, pincode, city, state, is_default) VALUES
(6,'17 Station Road',395003,'Surat','Gujarat',1);

INSERT INTO customer_shipping_addresses
(customer_id, address, pincode, city, state, is_default) VALUES
(7,'91 GT Road',141001,'Ludhiana','Punjab',1);
INSERT INTO customer_shipping_addresses
(customer_id, address, pincode, city, state, is_default) VALUES
(7,'Amritsar Branch',143001,'Amritsar','Punjab',0);

INSERT INTO customer_shipping_addresses
(customer_id, address, pincode, city, state, is_default) VALUES
(8,'56 Residency Road',302001,'Jaipur','Rajasthan',1);

INSERT INTO customer_shipping_addresses
(customer_id, address, pincode, city, state, is_default) VALUES
(9,'34 Lake View',600001,'Chennai','Tamil Nadu',1);
INSERT INTO customer_shipping_addresses
(customer_id, address, pincode, city, state, is_default) VALUES
(9,'Coimbatore Unit',641001,'Coimbatore','Tamil Nadu',0);

INSERT INTO customer_shipping_addresses
(customer_id, address, pincode, city, state, is_default) VALUES
(10,'76 SG Highway',380015,'Ahmedabad','Gujarat',1);
INSERT INTO customer_shipping_addresses
(customer_id, address, pincode, city, state, is_default) VALUES
(10,'Vadodara Warehouse',390001,'Vadodara','Gujarat',0);