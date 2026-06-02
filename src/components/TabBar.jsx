import Tab from "./Tab";

function TabBar({
    tabs,
    activeTab,
    setActiveTab
})
{
    return (
        <div className="tab-bar">

            {tabs.map(tab => (
                <Tab
                    key={tab.id}
                    title={tab.title}
                    active={
                        activeTab === tab.id
                    }
                    onClick={() =>
                        setActiveTab(tab.id)
                    }
                />
            ))}

        </div>
    );
}

export default TabBar;