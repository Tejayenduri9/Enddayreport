import { useState } from "react";
import { db } from "./firebase";
import { collection, addDoc } from "firebase/firestore";

function App() {
  const getToday = () => new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    date: getToday(),
    ownerEmails: "tejayenduri9999@gmail.com, Vincegeorge2001@yahoo.co.in",

    // Guests
    lunchGuests: "",
    dinnerGuests: "",
    dineInSales: "",

    // Cash
    cashSale: "",
    cashTip: "",
    cashCatering: "",

    // Credit card
    totalSettle: "",
    creditCardTip: "",

    // Sales Channels
    giftCard: "",
    restaurantOnline: "",
    grubhub: "",
    doordash: "",
    uberEats: "",

    // Hidden values (for backend only)
    totalCashWithTip: "",
    creditCardSale: "",
    systemGross: "",
    totalInHouse: "",
    totalRestaurantOnline: "",
    totalRestaurantSales: "",
    totalSalesDay: ""
  });

  const handleChange = (e) => {
    const updated = {
      ...form,
      [e.target.name]: e.target.value
    };

    // ===== CASH =====
    const cashSale = Number(updated.cashSale) || 0;
    const cashTip = Number(updated.cashTip) || 0;
    const cashCatering = Number(updated.cashCatering) || 0;

    const grandTotalCash = cashSale + cashTip + cashCatering;

    // ===== CREDIT CARD =====
    const totalSettle = Number(updated.totalSettle) || 0;
    const creditCardTip = Number(updated.creditCardTip) || 0;

    const creditCardSale = totalSettle - creditCardTip;

    // ===== SYSTEM =====
    const systemGross = cashSale + creditCardSale;

    const giftCard = Number(updated.giftCard) || 0;
    const totalInHouse = systemGross - giftCard;

    // ===== ONLINE =====
    const restaurantOnline = Number(updated.restaurantOnline) || 0;
    const grubhub = Number(updated.grubhub) || 0;
    const doordash = Number(updated.doordash) || 0;
    const uberEats = Number(updated.uberEats) || 0;

    const onlineSale =
      restaurantOnline + grubhub + doordash + uberEats;

    // ===== FINAL TOTALS =====
    const totalRestaurantSales = totalInHouse + onlineSale;

    const totalSalesDay =
      totalRestaurantSales + cashCatering;

    // ===== STORE (ONLY FOR BACKEND) =====
    updated.totalCashWithTip = grandTotalCash;
    updated.creditCardSale = creditCardSale;
    updated.systemGross = systemGross;
    updated.totalInHouse = totalInHouse;
    updated.totalRestaurantOnline = onlineSale;

    updated.totalRestaurantSales = totalRestaurantSales;
    updated.totalSalesDay = totalSalesDay;

    setForm(updated);
  };

  const saveData = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL;

      await addDoc(collection(db, "restaurants"), {
        ...form,
        createdAt: new Date()
      });

      const response = await fetch(`${API_URL}/generate-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });

      if (!response.ok) throw new Error("Backend request failed");

      alert("Saved + Report Sent!");

    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2>Spice Malabar Sales Report</h2>

        {/* LOCKED DATE */}
        <input
          type="date"
          value={form.date}
          readOnly
          style={{ ...styles.input, background: "#eee" }}
        />

        {/* LOCKED EMAIL */}
        <input
          value={form.ownerEmails}
          readOnly
          style={{ ...styles.input, background: "#eee" }}
        />

        <h3>Guests</h3>
        <input name="lunchGuests" placeholder="Lunch Guests" value={form.lunchGuests} onChange={handleChange} style={styles.input}/>
        <input name="dinnerGuests" placeholder="Dinner Guests" value={form.dinnerGuests} onChange={handleChange} style={styles.input}/>
        <input name="dineInSales" placeholder="Dine In Sales" value={form.dineInSales} onChange={handleChange} style={styles.input}/>

        <h3>Cash</h3>
        <input name="cashSale" placeholder="Cash Sale" value={form.cashSale} onChange={handleChange} style={styles.input}/>
        <input name="cashTip" placeholder="Cash Tip" value={form.cashTip} onChange={handleChange} style={styles.input}/>
        <input name="cashCatering" placeholder="Cash Catering" value={form.cashCatering} onChange={handleChange} style={styles.input}/>

        <h3>Credit Card</h3>
        <input name="totalSettle" placeholder="Total Credit Card Settle Amt" value={form.totalSettle} onChange={handleChange} style={styles.input}/>
        <input name="creditCardTip" placeholder="Total Credit Card Tip" value={form.creditCardTip} onChange={handleChange} style={styles.input}/>

        <h3>Sales Channels</h3>
        <input name="giftCard" placeholder="Gift Card Redeemed" value={form.giftCard} onChange={handleChange} style={styles.input}/>

        <h3>Restaurant Online</h3>
        <input name="restaurantOnline" placeholder="Restaurant Online" value={form.restaurantOnline} onChange={handleChange} style={styles.input}/>
        <input name="grubhub" placeholder="Grubhub" value={form.grubhub} onChange={handleChange} style={styles.input}/>
        <input name="doordash" placeholder="DoorDash" value={form.doordash} onChange={handleChange} style={styles.input}/>
        <input name="uberEats" placeholder="Uber Eats" value={form.uberEats} onChange={handleChange} style={styles.input}/>

        <button onClick={saveData} style={styles.button}>
          Save & Send Report
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    padding: "20px",
    background: "#f5f5f5"
  },
  card: {
    background: "#fff",
    padding: "20px",
    width: "400px",
    borderRadius: "10px",
    boxShadow: "0 4px 10px rgba(0,0,0,0.1)"
  },
  input: {
    width: "100%",
    marginBottom: "10px",
    padding: "8px",
    borderRadius: "5px",
    border: "1px solid #ccc"
  },
  button: {
    padding: "12px",
    background: "green",
    color: "white",
    border: "none",
    borderRadius: "5px",
    width: "100%",
    cursor: "pointer",
    fontWeight: "bold"
  }
};

export default App;