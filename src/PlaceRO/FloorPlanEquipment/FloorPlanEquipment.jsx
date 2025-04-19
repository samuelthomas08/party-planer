import { useEffect, useRef, useState } from 'react';

import './FloorPlanEquipment.sass';
import { db } from '../../firebase/firebase';

import { collection, getDocs, query } from 'firebase/firestore';


const FloorPlanEquipment = ({ data }) => {

    const [color, setColor] = useState(data.data.color);

    const selectedCategory = data.data.category;

    const [currentEquipmentSelection, setCurrentEquipmentSelection] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            const q = query(collection(db, "equipment"));

            const querySnapshot = await getDocs(q);

            const dbData = querySnapshot.docs.map(el => ({ id: el.id, ...el.data() }));

            const equipment = dbData.filter(el => el.id == data.data.selectedEquipment)[0];
            
            console.log('AKTUELLES EQUIPMENT: ');
            console.log(equipment);
            console.log('-------------------------------------');

            setCurrentEquipmentSelection(equipment);
        };

        fetchData();   
    }, []);

    return currentEquipmentSelection ? (
        <div className="FloorPlanEquipment" style={{
            display: data.showOptions ? 'block' : 'none'
        }}>

            <div className="equipment-slider">
                <div className="card">
                    {selectedCategory == 0  ? 
                        <div className='equipment-item'>
                            <h3>{currentEquipmentSelection.title}</h3>

                            <div className="img-container">
                                {currentEquipmentSelection.contents.topBarAdd ? <img className='top-bar-add' src={currentEquipmentSelection.contents.topBarAdd} /> : null}
                                {currentEquipmentSelection.contents.topBar ? <img className='top-bar' src={currentEquipmentSelection.contents.topBar} /> : null}
                                {currentEquipmentSelection.contents.foot ? <img className='foot' src={currentEquipmentSelection.contents.foot} /> : null}
                                <div className="lights">
                                    <div className="light-container">
                                        {currentEquipmentSelection.contents.light01 ? <img className='light-01' src={currentEquipmentSelection.contents.light01} /> : null}
                                        {currentEquipmentSelection.contents.light02 ? <img className='light-02' src={currentEquipmentSelection.contents.light02} /> : null}
                                    </div>
                                    {currentEquipmentSelection.contents.light03 ? <img className='light-03' src={currentEquipmentSelection.contents.light03} /> : null}
                                    <div className="light-container">
                                        {currentEquipmentSelection.contents.light04 ? <img className='light-04' src={currentEquipmentSelection.contents.light04} /> : null}
                                        {currentEquipmentSelection.contents.light05 ? <img className='light-05' src={currentEquipmentSelection.contents.light05} /> : null}
                                    </div>
                                </div>
                            </div>
                        </div> : 
                        (currentEquipmentSelection != null ? <div className='equipment-item-other-cat'>
                            <h3>{currentEquipmentSelection.title}</h3>

                            <div className="img-container-other-cat">
                                <img className='other-category-img' src={currentEquipmentSelection?.contents?.img || ''} />
                            </div>
                        </div> : null)
                    }
                </div>
            </div>

            <div className='description'>
                <h3>Beschreibung</h3>
                <p>{selectedCategory == 0 && currentEquipmentSelection != null ? 
                    (currentEquipmentSelection.description == '' ? 
                        'Keine Beschreibung enthalten...' : currentEquipmentSelection.description) : 
                    (currentEquipmentSelection != null ? 
                        (currentEquipmentSelection.description == '' ? 
                            'Keine Beschreibung enthalten...' : currentEquipmentSelection.description) : null)}</p>
            </div>

            <div className="color-selection">
                <label htmlFor='color'>Farbe</label>
                <div className="color-select-container">
                    <input onInput={e => {
                        setColor(e.target.value);
                        data.data.color = color;
                        console.log(data);
                    }} type='text' id='color' value={color} readOnly />
                    <div className="color-represent" style={{background: color}}></div>
                </div>
            </div>
        </div>
    ) : null;
}   

export default FloorPlanEquipment;