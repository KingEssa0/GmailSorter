import "./SummaryCard.css";

function SummaryCard({ title, value }) {
    return (
        <div className="summary-card">
            <h3>{title}</h3>
            <p className="value">{value}</p>
        </div>
    );
}

export default SummaryCard;
