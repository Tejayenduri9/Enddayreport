import { useState } from "react";
import { db } from "./firebase";
import { collection, addDoc } from "firebase/firestore";

function App() {
  const getToday = () => new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    date: getToday(),

    ownerEmails: "",

    cashSale: "",
    cashTip: "",
    cashCatering: "",

    lunchGuests: "",
    dinnerGuests: "",
    dineInSales: "",

    creditCardSale: "",

    systemGross: "",
    giftCard: "",
    totalInHouse: "",
    restaurantOnline: "",
    grubhub: "",
    doordash: "",
    uberEats: "",

    totalCashWithTip: "",
    totalRestaurantSales: "",
    totalSalesDay: ""
  });

  const handleChange = (e) => {
    const updatedForm = {
      ...form,
      [e.target.name]: e.target.value
    };

    // ✅ Total Cash with Tip
    const cashSale = Number(updatedForm.cashSale) || 0;
    const cashTip = Number(updatedForm.cashTip) || 0;
    updatedForm.totalCashWithTip = cashSale + cashTip;

    // ✅ Total Restaurant Sales
    const fields = [
      "cashSale",
      "cashTip",
      "cashCatering",
      "creditCardSale",
      "systemGross",
      "giftCard",
      "totalInHouse",
      "restaurantOnline",
      "grubhub",
      "doordash",
      "uberEats"
    ];

    let total = 0;
    fields.forEach((f) => {
      total += Number(updatedForm[f]) || 0;
    });

    updatedForm.totalRestaurantSales = total;

    setForm(updatedForm);
  };

  const saveData = async () => {
    try {
      await addDoc(collection(db, "restaurants"), {
        ...form,
        restaurantName: "Spice Malabar",
        createdAt: new Date()
      });

      await fetch("http://localhost:5050/generate-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });

      alert("Saved + Report Sent!");

      setForm({
        date: getToday(),

        ownerEmails: "",

        cashSale: "",
        cashTip: "",
        cashCatering: "",

        lunchGuests: "",
        dinnerGuests: "",
        dineInSales: "",

        creditCardSale: "",

        systemGross: "",
        giftCard: "",
        totalInHouse: "",
        restaurantOnline: "",
        grubhub: "",
        doordash: "",
        uberEats: "",

        totalCashWithTip: "",
        totalRestaurantSales: "",
        totalSalesDay: ""
      });

    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2>Spice Malabar Daily Report</h2>

        {/* DATE */}
        <input
          type="date"
          name="date"
          value={form.date}
          onChange={handleChange}
          style={styles.input}
        />

        {/* EMAILS */}
        <input
          name="ownerEmails"
          value={form.ownerEmails}
          placeholder="Owner Emails (comma separated)"
          onChange={handleChange}
          style={styles.input}
        />

        <h3>Cash</h3>
        <input name="cashSale" value={form.cashSale} placeholder="Cash Sale" onChange={handleChange} style={styles.input}/>
        <input name="cashTip" value={form.cashTip} placeholder="Cash Tip" onChange={handleChange} style={styles.input}/>

        <input
          name="totalCashWithTip"
          value={form.totalCashWithTip}
          placeholder="Total Cash w/ Tip"
          readOnly
          style={{ ...styles.input, background: "#eee" }}
        />

        <input name="cashCatering" value={form.cashCatering} placeholder="Cash Catering" onChange={handleChange} style={styles.input}/>

        <h3>Guests</h3>
        <input name="lunchGuests" value={form.lunchGuests} placeholder="Lunch Guests" onChange={handleChange} style={styles.input}/>
        <input name="dinnerGuests" value={form.dinnerGuests} placeholder="Dinner Guests" onChange={handleChange} style={styles.input}/>
        <input name="dineInSales" value={form.dineInSales} placeholder="Dine In Sales" onChange={handleChange} style={styles.input}/>

        <h3>Credit Card</h3>
        <input name="creditCardSale" value={form.creditCardSale} placeholder="Credit Card Sale" onChange={handleChange} style={styles.input}/>

        <h3>Sales Channels</h3>
        <input name="systemGross" value={form.systemGross} placeholder="System Gross Sale" onChange={handleChange} style={styles.input}/>
        <input name="giftCard" value={form.giftCard} placeholder="Gift Card Redeemed" onChange={handleChange} style={styles.input}/>
        <input name="totalInHouse" value={form.totalInHouse} placeholder="Total Sale In House" onChange={handleChange} style={styles.input}/>
        <input name="restaurantOnline" value={form.restaurantOnline} placeholder="Restaurant Online" onChange={handleChange} style={styles.input}/>
        <input name="grubhub" value={form.grubhub} placeholder="Grubhub" onChange={handleChange} style={styles.input}/>
        <input name="doordash" value={form.doordash} placeholder="DoorDash" onChange={handleChange} style={styles.input}/>
        <input name="uberEats" value={form.uberEats} placeholder="Uber Eats" onChange={handleChange} style={styles.input}/>

        <h3>Final Totals</h3>
        <input
          name="totalRestaurantSales"
          value={form.totalRestaurantSales}
          placeholder="Total Restaurant Sales"
          readOnly
          style={{ ...styles.input, background: "#eee" }}
        />

        <input
          name="totalSalesDay"
          value={form.totalSalesDay}
          placeholder="Total Sales of the Day"
          onChange={handleChange}
          style={styles.input}
        />

        <button onClick={saveData} style={styles.button}>
          Save
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    background: "#f5f5f5",
    padding: "20px"
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
    padding: "10px",
    background: "green",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    width: "100%"
  }
};

export default App;