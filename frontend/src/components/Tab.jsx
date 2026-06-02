function Tab({ title, active, onClick })
{
    return (
        <div
            className={active ? "tab active" : "tab"}
            onClick={onClick}
        >
            {title}
        </div>
    );
}

export default Tab;