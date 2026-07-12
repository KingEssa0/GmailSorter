function Sidebar({ categories, selectedCategory, onSelectCategory }) {
    return (
        <div className="sidebar">
            <h2>Categories</h2>
            <ul>
                {categories.length === 0 && <li>No categories yet</li>}
                {categories.map(cat => (
                    <li
                        key={cat._id}
                        onClick={() => onSelectCategory(cat)}
                        style={{
                            cursor: "pointer",
                            fontWeight: selectedCategory?._id === cat._id ? "bold" : "normal"
                        }}
                    >
                        {cat.name} ({cat.emailCount ?? 0})
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default Sidebar;