# ⚡ ZUNO Quick Start Guide

**Get your ZUNO website running in 3 minutes!**

---

## 🚀 Start Your Website

### **Step 1: Open Terminal**
- Press `Win + R`
- Type `cmd` and press Enter

### **Step 2: Navigate to Project**
```bash
cd C:\Users\Anand\Desktop\Zuno
```

### **Step 3: Start Server**
```bash
npm start
```

### **Step 4: Open Website**
- Open browser (Chrome, Firefox, Edge)
- Go to: **http://localhost:4000**

**✅ Website is now running!**

---

## 🔐 Access Founder Dashboard

1. Click **"Sign in"** (top right)
2. Enter credentials:
   - **Email:** `admin@zuno.app`
   - **Password:** `Admin@1234`
3. Click **"⚡ Founder Dashboard"** in navigation

**You're in! 🎉**

---

## 📦 When You Get an Order

### **Quick Steps:**

1. **Go to Founder Dashboard**
2. **Click "✦ Custom Orders" tab** (for custom designs) or "All Orders" (for all)
3. **Find the new order**
4. **Note down:**
   - ✅ Customer name
   - ✅ Phone number
   - ✅ Full address
   - ✅ T-shirt: Color, Size, Fit
   - ✅ Design details (text + images)
   - ✅ Special notes

5. **Prepare the order:**
   - Get t-shirt in correct color and size
   - Print the design (see preview in dashboard)
   - Quality check

6. **Update status:**
   - CONFIRMED → PRINTING → PACKED → SHIPPED

7. **Ship to customer** using the address in dashboard

---

## 🎨 Custom Order Details You'll See

### **Customer Info:**
```
Name: Rohan Kumar
Phone: +91 98765 43210
Email: rohan@example.com

Address:
Flat 101, ABC Apartments
MG Road, Bangalore, Karnataka
PIN: 560001
Landmark: Near City Mall
```

### **T-Shirt Specs:**
```
Color: Black
Size: L
Fit: Oversized
```

### **Design:**
```
FRONT:
- Text: "ZUNO STREETWEAR" (Bold, 36px, White)
- Image: Logo (uploaded by customer - you can see it)

BACK:
- Text: "EST. 2024" (28px, White)
```

**Everything you need to prepare the order!**

---

## 🎯 Daily Workflow

### **Morning:**
```bash
1. Open terminal
2. cd C:\Users\Anand\Desktop\Zuno
3. npm start
4. Open http://localhost:4000
5. Login as founder
6. Check new orders
```

### **Throughout Day:**
- Update order statuses
- Prepare designs
- Print and pack

### **Evening:**
- Ship completed orders
- Plan tomorrow's production

---

## 🛠️ Common Commands

### **Start Website:**
```bash
npm start
```

### **Stop Website:**
- Press `Ctrl + C` in terminal

### **Restart:**
```bash
# Press Ctrl + C to stop, then:
npm start
```

---

## 📱 Quick Access URLs

| Page | URL |
|------|-----|
| Homepage | http://localhost:4000 |
| Shop | http://localhost:4000/#/shop |
| Custom Studio | http://localhost:4000/#/customize |
| Founder Dashboard | http://localhost:4000/#/admin |
| Login | http://localhost:4000/#/login |

---

## 🔑 Login Credentials

### **Founder (You):**
```
Email: admin@zuno.app
Password: Admin@1234
```

### **Test Customer (for testing):**
```
Register new account with any email/phone
Or use OTP login
```

---

## 📊 Order Status Flow

```
💳 PAYMENT_PENDING
    ↓
✅ PAID (Customer paid)
    ↓
✅ CONFIRMED (You confirmed)
    ↓
🎨 PRINTING (Custom design being printed)
    ↓
🔍 QUALITY_CHECK (Checking quality)
    ↓
📦 PACKED (Ready to ship)
    ↓
🚚 SHIPPED (Sent to customer)
    ↓
🛵 OUT_FOR_DELIVERY
    ↓
✅ DELIVERED
```

---

## 🎨 Where to Find Things

### **In Founder Dashboard:**

| Tab | What You See |
|-----|-------------|
| Overview | Sales summary, stats |
| All Orders | Every order |
| Production | Orders to process |
| **✦ Custom Orders** | **Custom designs with full details** |
| Products | Manage t-shirts |
| Customers | Customer list |

---

## ⚠️ Troubleshooting

### **Website won't start?**
```bash
# Try this:
cd C:\Users\Anand\Desktop\Zuno
npm install
npm start
```

### **Can't login?**
- Check email: `admin@zuno.app`
- Check password: `Admin@1234`
- Make sure CAPS LOCK is off

### **Order not showing?**
- Refresh the page (F5)
- Check "Custom Orders" tab
- Check "All Orders" tab

### **Custom design not loading?**
- Customer might not have completed it
- Check if payment was successful
- Try refreshing

---

## 💡 Pro Tips

### **Bookmark These:**
- Founder Dashboard: http://localhost:4000/#/admin
- Custom Orders: http://localhost:4000/#/admin (then click Custom Orders tab)

### **Keep Terminal Open:**
- Don't close the terminal window while working
- Website stops if you close terminal

### **Backup Database:**
- Copy this file weekly: `backend/database.sqlite`
- This has all your orders!

### **Test First:**
- Create test orders yourself
- Try custom studio
- Test complete checkout flow
- Verify you see all details in dashboard

---

## 📋 Pre-Launch Checklist

Before accepting real orders:

- [ ] Start website successfully
- [ ] Login to founder dashboard
- [ ] Create a test order (custom design)
- [ ] Verify you see all customer details
- [ ] Test order status updates
- [ ] Check custom design preview works
- [ ] Verify address is complete
- [ ] Set up Razorpay (payment gateway)
- [ ] Add real t-shirt inventory
- [ ] Test print quality
- [ ] Change default admin password

---

## 🚀 You're Ready!

**Three commands to remember:**

1. **Open terminal** → `cd C:\Users\Anand\Desktop\Zuno`
2. **Start server** → `npm start`
3. **Open browser** → http://localhost:4000

**That's it! Your business is online! 🎉**

---

## 📞 Need More Help?

→ Read **FOUNDER_GUIDE.md** for detailed instructions
→ Read **README.md** for technical details

---

*Quick reference for ZUNO Founder - Keep this handy! 📌*
