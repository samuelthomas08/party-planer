import './Equipment.sass';

import { db } from '../../firebase/firebase';

import { collection, query, getDocs, where, doc } from 'firebase/firestore';

import EquipmentItem from './EquipmentItem/EquipmentItem';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';


const Equipment = () => {

    const [equipmentList, setEquipmentList] = useState([]);

    useEffect(() => {
        const fetchData = async (e) => {
            const q = query(collection(db, "equipment"));

            const querySnapshot = await getDocs(q);

            const data = querySnapshot.docs.map(el => ({ id: el.id, ...el.data() }));
            setEquipmentList(data);
        }

        fetchData();
    }, []);

    return (
        <div className="Equipment">
            <h1>Equipment</h1>

            <div className="contents">
                {equipmentList.map(el => {
                    return <EquipmentItem title={el.title} category={el.category} description={el.description} imgs={el.contents} titleId={el.titleId} equipmentList={equipmentList} setEquipmentList={setEquipmentList} />
                })}

                <Link className='new-equipment-link' to={'/new-equipment'}>
                    <div className="new-equipment">
                        <FontAwesomeIcon className='icon' icon={faPlus} />
                        <h2>Neues Equipment</h2>
                    </div>
                </Link>
                
            </div>
        </div>
    );
}

export default Equipment;