# 🎯 ZUNO Founder Guide

**Welcome to your ZUNO clothing brand website!** This guide explains everything you need to know to run your business.

---

## 🚀 Quick Start

### 1. **Install & Setup**
```bash
# Navigate to your project folder
cd C:\Users\Anand\Desktop\Zuno

# Install dependencies (only needed once)
npm install

# Copy environment file and configure
cp .env.example .env

# Edit .env file with your details:
# - JWT_SECRET: Any random string (keep it secret!)
# - RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET: Get from razorpay.com
# - Database will be created automatically
```

### 2. **Start Your Website**
```bash
# Run this command to start the server
npm start

# Your website will be available at:
# http://localhost:4000
```

### 3. **Access Founder Dashboard**
1. Open: `http://localhost:4000`
2. Click **"Sign in"** in the top right
3. Login with founder credentials:
   - **Email:** `admin@zuno.app`
   - **Password:** `Admin@1234`
4. You'll see **"⚡ Founder Dashboard"** link in navigation (only visible to you!)
5. Click it to access all order details

---

## 👕 How Your ZUNO Website Works

### **For Customers:**

1. **Browse T-Shirts** → Shop page with all products
2. **Customize Their Own** → Custom Studio to design unique t-shirts
3. **Add to Cart** → Regular or custom products
4. **Checkout** → Add delivery address, pay securely
5. **Track Orders** → See order status and delivery timeline

### **For You (Founder):**

1. **View All Orders** → See every customer order with full details
2. **Customer Information** → Name, phone, email, complete address
3. **Custom Design Details** → See exactly what text/images customers want
4. **Prepare & Deliver** → Use the information to create and ship products

---

## 🔐 Founder Dashboard Features

### **1. Overview Tab**
- Total sales, revenue, order counts
- Recent activity summary
- Quick statistics

### **2. All Orders Tab**
Shows every order with:
- Order number and date
- Customer name and contact
- Order status (PAID, CONFIRMED, PRINTING, SHIPPED, etc.)
- Total amount

### **3. Production Queue Tab**
Orders that need action:
- Status: CONFIRMED, PRINTING, PACKED
- Ready to be processed and shipped

### **4. ✦ Custom Orders Tab** (Most Important!)
This shows all custom t-shirt orders with **COMPLETE DETAILS:**

#### **Customer Information:**
- Full name
- Phone number
- Email address
- Complete shipping address:
  - Street address
  - City
  - State
  - PIN code
  - Landmark (if provided)

#### **T-Shirt Specifications:**
- Color (Black, White, Grey, Navy, Beige, etc.)
- Size (XS, S, M, L, XL, XXL, XXXL)
- Fit (Regular, Oversized, Relaxed)

#### **Custom Design Details:**
- **Front Design:**
  - All text elements with exact text, font, size, color
  - All uploaded images (you can see them)
  
- **Back Design:**
  - All text elements with exact text, font, size, color
  - All uploaded images (you can see them)

- **Visual Preview:**
  - See the t-shirt with selected color
  - See how the design should look

#### **Customer Notes:**
- Any special instructions from customer
- Design placement preferences
- Special requests

### **5. Products Tab**
- Add new t-shirts
- Edit existing products
- Manage inventory

### **6. Customers Tab**
- View all registered customers
- Customer contact information
- Order history

---

## 📦 Order Workflow

### **Order Statuses Explained:**

1. **PAYMENT_PENDING** → Customer hasn't paid yet
2. **PAID** ✅ → Payment received (you get notified)
3. **CONFIRMED** ✅ → Order confirmed, ready for production
4. **PRINTING** 🎨 → Custom design is being printed
5. **QUALITY_CHECK** 🔍 → Checking quality before packing
6. **PACKED** 📦 → Ready to ship
7. **SHIPPED** 🚚 → Order dispatched
8. **OUT_FOR_DELIVERY** 🛵 → On the way to customer
9. **DELIVERED** ✅ → Customer received the order

### **Your Action Steps:**

When you get a new order:

1. **Check Founder Dashboard → Custom Orders tab**
2. **Note down all customer details:**
   - Name, phone, address
   - T-shirt color, size, fit
   - Custom design (text & images)
   - Any special notes

3. **Prepare the Product:**
   - Get the correct color t-shirt in the right size
   - Print the custom design (front and back)
   - Quality check

4. **Update Status:**
   - Click on order → Update status as you progress
   - Customer can track on their end

5. **Ship the Order:**
   - Pack properly
   - Use customer's full address
   - Update status to SHIPPED

---

## 🎨 Custom Studio - How It Works

### **Customers Can:**

1. **Select Base Product:**
   - Choose t-shirt style
   - Pick color (12 options: White, Black, Grey, Navy, Beige, Olive, Red, Maroon, Forest, Sage, Mustard, Charcoal)
   - Select size (XS to XXXL)
   - Choose fit (Regular, Oversized, Relaxed)

2. **Design Front & Back:**
   - Switch between front/back views
   - Add multiple text elements
   - Upload images/logos/photos
   - Drag, resize, rotate elements
   - Change colors, fonts, styles

3. **Live Preview:**
   - See design in real-time
   - T-shirt color updates instantly
   - Elements stay within print area

4. **Add to Cart:**
   - Save design
   - Proceed to checkout

### **You See in Dashboard:**
- Complete design visualization
- All text with exact styling
- All uploaded images
- Element positions (front/back)
- T-shirt specifications

---

## 💰 Pricing & Payments

### **Base Prices:**
- Regular T-shirts: ₹1,299 - ₹1,799
- Custom T-shirts: Base price + ₹100/side for printing
  - Front design only: Base + ₹100
  - Back design only: Base + ₹100
  - Front + Back: Base + ₹200

### **Payment:**
- Integrated with Razorpay (secure payment gateway)
- Test mode for development
- Production mode when you're ready to go live

### **Setup Razorpay:**
1. Sign up at razorpay.com
2. Get API keys from dashboard
3. Add to `.env` file:
   ```
   RAZORPAY_KEY_ID=your_key_id
   RAZORPAY_KEY_SECRET=your_key_secret
   ```

---

## 📱 Website Features

### **Homepage:**
- Hero section with brand message
- Featured collection
- New drops
- Best sellers
- Custom Studio teaser
- Customer reviews
- Newsletter signup

### **Shop Page:**
- All t-shirts displayed
- Filter by:
  - Category (Oversized, Graphic, Plain, etc.)
  - Size
  - Color
  - Fit
  - Price range
- Sort by popularity, newest, price

### **Custom Studio:**
- Interactive design tool
- Color picker with labels
- Text editor with fonts and styles
- Image upload (drag & drop)
- Live preview
- Save designs for later

### **Cart & Checkout:**
- Shows regular and custom products
- Custom orders display design preview
- Guest checkout or login
- Address management
- Order notes field
- Secure payment

### **Orders & Tracking:**
- Order history
- Live status updates
- Custom design preview
- Delivery timeline
- Invoice download

---

## 🔒 Security & Access

### **Founder Account:**
- **Role:** ADMIN
- Only you can access Founder Dashboard
- Dashboard link only appears when logged in as founder
- Protected routes block non-admin access

### **Customer Accounts:**
- **Role:** USER
- Can browse, customize, order, track
- Cannot access founder dashboard
- Personal data protected

### **Best Practices:**
- Keep founder credentials secure
- Change default password
- Use strong JWT_SECRET in .env
- Don't share admin login

---

## 📊 Managing Your Business

### **Daily Tasks:**

1. **Morning:**
   - Check Founder Dashboard for new orders
   - Review custom designs
   - Plan production for the day

2. **Throughout Day:**
   - Update order statuses as you progress
   - Respond to customer queries (if any)
   - Prepare and print custom designs

3. **Evening:**
   - Pack completed orders
   - Update shipping status
   - Review next day's orders

### **Weekly Tasks:**

- Check inventory levels
- Review sales analytics
- Plan new products/designs
- Check customer feedback

---

## 🎯 Tips for Success

### **For Custom Orders:**

1. **Quality Check:**
   - Verify text is spelled correctly
   - Check image quality before printing
   - Ensure colors match customer selection

2. **Communication:**
   - Customer notes are visible in dashboard
   - Follow special instructions carefully
   - Update status regularly

3. **Printing Guidelines:**
   - Use high-quality printing
   - Print within the print area
   - Test prints before final production

### **For Regular Orders:**

1. **Stock Management:**
   - Keep popular sizes in stock
   - Monitor which colors sell most
   - Restock best sellers

2. **Fast Shipping:**
   - Pack orders same day when possible
   - Use reliable courier services
   - Update tracking information

---

## 🛠️ Troubleshooting

### **Website Not Starting:**
```bash
# Make sure you're in the right directory
cd C:\Users\Anand\Desktop\Zuno

# Check if dependencies are installed
npm install

# Try starting again
npm start
```

### **Can't Login to Founder Dashboard:**
- Email: `admin@zuno.app`
- Password: `Admin@1234`
- Make sure caps lock is off
- Try clearing browser cache

### **Order Not Showing:**
- Check "All Orders" tab
- Look in "Custom Orders" tab for custom designs
- Refresh the page
- Check if payment was successful

### **Custom Design Not Loading:**
- Image might be too large
- Check if design was saved
- Customer might have left before completing

---

## 📞 Support & Resources

### **Technical Documentation:**
- Full README: `README.md` in project folder
- API documentation available
- Code comments explain functionality

### **File Structure:**
```
Zuno/
├── backend/           # Server code
│   ├── app/
│   │   ├── api/      # API endpoints
│   │   ├── models/   # Database models
│   │   └── services/ # Business logic
│   └── main.js       # Server entry
├── public/           # Frontend
│   ├── assets/
│   │   ├── css/     # Styles
│   │   └── js/      # JavaScript
│   └── index.html
└── .env             # Configuration
```

### **Database:**
- Location: `backend/database.sqlite`
- Backup regularly
- Contains all orders, users, products

---

## 🎨 Customization Tips

### **Adding New T-Shirt Colors:**
Edit `public/assets/js/pages/customize.js` - add to COLORS array

### **Changing Prices:**
Edit product prices in Founder Dashboard → Products tab

### **Updating Homepage:**
Edit `public/assets/js/pages/home.js`

---

## ✅ Checklist: Going Live

Before launching to real customers:

- [ ] Change default admin password
- [ ] Set up real Razorpay account (not test mode)
- [ ] Add your products/t-shirts
- [ ] Test complete order flow
- [ ] Set up domain name
- [ ] Add your contact information
- [ ] Test custom studio thoroughly
- [ ] Set up shipping courier accounts
- [ ] Prepare inventory of blank t-shirts
- [ ] Set up printing equipment/service
- [ ] Create social media accounts
- [ ] Take product photos
- [ ] Write product descriptions

---

## 🚀 Launch Day & Beyond

### **When You Get Your First Order:**

1. 🎉 Celebrate!
2. Check Founder Dashboard immediately
3. Note all customer details
4. Prepare the product with care
5. Update status regularly
6. Ship promptly
7. Follow up for feedback

### **Growing Your Business:**

- Promote Custom Studio feature (unique selling point!)
- Share customer photos on social media
- Offer seasonal designs
- Run promotions (use coupon system)
- Collect reviews
- Build email list (newsletter)

---

## 📈 Analytics & Insights

### **Available in Dashboard:**

- Total revenue
- Number of orders
- Custom vs regular order ratio
- Popular colors
- Popular sizes
- Best selling products
- Customer count

### **Use This Data To:**

- Stock right sizes/colors
- Plan custom design templates
- Set pricing
- Create promotions
- Understand your customers

---

## 🎓 Understanding the Tech

### **No Coding Required!**

Everything is set up and ready. You just need to:
- Start the server (`npm start`)
- Use the Founder Dashboard
- Update order statuses
- Add products if needed

### **If You Want to Learn:**

The website is built with:
- **Backend:** Node.js (JavaScript on server)
- **Frontend:** Modern JavaScript (no complex frameworks)
- **Database:** SQLite (simple, file-based)
- **Payments:** Razorpay (Indian payment gateway)

---

## 💡 Pro Tips

1. **Regular Backups:**
   - Copy `backend/database.sqlite` file weekly
   - Store safely (this has all your orders!)

2. **Customer Photos:**
   - Ask customers to share photos wearing ZUNO
   - Use for marketing
   - Feature on homepage

3. **Quick Response:**
   - Check orders multiple times daily
   - Fast fulfillment = happy customers
   - Update status promptly

4. **Quality First:**
   - Use good quality t-shirts
   - High-quality printing
   - Proper packaging
   - Include thank you note!

5. **Custom Studio Marketing:**
   - "Design your own t-shirt" is unique
   - Promote heavily
   - Show example designs
   - Make tutorial video

---

## 🎯 Your Unique Advantage

**ZUNO Custom Studio** is your key differentiator:
- Customers design their own t-shirts
- Live preview (they see it before ordering)
- You get complete design details
- Higher margins on custom orders
- Customers love personalization

**Focus on this feature** - it's what makes ZUNO special!

---

## 📱 Contact & Support

### **Need Help?**

- Check this guide first
- Review README.md for technical details
- Database issues: backup and restart
- Payment issues: check Razorpay dashboard
- Design issues: check Custom Orders tab

### **Remember:**

- You're the founder - you control everything!
- Founder Dashboard has all information you need
- Take it step by step
- Start with test orders
- Scale as you grow

---

## 🎉 You're Ready!

You now have:
✅ Complete e-commerce website
✅ Custom t-shirt design studio
✅ Founder dashboard with all customer details
✅ Secure payment system
✅ Order tracking
✅ Professional design
✅ Mobile-friendly
✅ Ready for real business!

**Your next steps:**
1. Run `npm start`
2. Login as founder
3. Test the complete flow
4. Add your products
5. Go live and start selling!

**Best of luck with ZUNO! 🚀👕**

---

*Made with ❤️ for ZUNO Founder - Your brand, your way, your success!*
